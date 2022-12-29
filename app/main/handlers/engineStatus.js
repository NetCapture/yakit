const {ipcMain} = require("electron")
const fs = require("fs")
const childProcess = require("child_process")
const path = require("path")
const os = require("os")
const _sudoPrompt = require("sudo-prompt")
const {GLOBAL_YAK_SETTING} = require("../state")
const {setLocalCache} = require("../localCache")
const {testClient, testRemoteClient} = require("../ipc")
const {getLocalYaklangEngine} = require("../filePath")

/**  获取缓存数据里本地引擎是否以管理员权限启动 */
const YaklangEngineSudo = "yaklang-engine-mode"
/**  获取缓存数据里本地引擎启动的端口号 */
const YaklangEnginePort = "yaklang-engine-port"

/** 本地引擎随机端口启动重试次数(防止无限制的随机重试，最大重试次数: 5) */
let engineCount = 0

/** 探测指定端口的本地yaklang引擎是否启动 */
const probeEngineProcess = (win, port, sudo) => {
    const mode = sudo ? "admin" : "local"
    const setting = JSON.stringify({port: port})
    console.log('probeEngine', mode, port);

    try {
        testClient(port, (err, result) => {
            if (!err) {
                setLocalCache(YaklangEnginePort, setting)
                setLocalCache(YaklangEngineSudo, mode)

                if (GLOBAL_YAK_SETTING.defaultYakGRPCAddr !== `localhost:${port}`) {
                    GLOBAL_YAK_SETTING.sudo = !!sudo
                    GLOBAL_YAK_SETTING.defaultYakGRPCAddr = `localhost:${port}`
                }
                win.webContents.send("start-yaklang-engine-success", sudo ? "admin" : "local")
                engineCount = 0
            } else {
                GLOBAL_YAK_SETTING.sudo = false
                GLOBAL_YAK_SETTING.defaultYakGRPCAddr = `127.0.0.1:8087`
                console.info("check local yaklang engine port failed!")
                console.info(err)
                win.webContents.send("local-yaklang-engine-end", err)
            }
        })
    } catch (e) {
        console.info(`check whether existed port:${port} open failed: `)
        console.info(e)
    } finally {
    }
}

/** 探测 远程引擎 是否启动 */
const probeRemoteEngineProcess = (win, params) => {
    const setting = JSON.stringify({
        host: params.host,
        port: params.port,
        caPem: params.caPem,
        password: params.password
    })

    try {
        testRemoteClient(params, (err, result) => {
            if (!!err) {
                GLOBAL_YAK_SETTING.sudo = false
                GLOBAL_YAK_SETTING.defaultYakGRPCAddr = `127.0.0.1:8087`
                GLOBAL_YAK_SETTING.caPem = ""
                GLOBAL_YAK_SETTING.password = ""
                win.webContents.send("local-yaklang-engine-end", err)
            } else {
                setLocalCache(YaklangEnginePort, setting)
                setLocalCache(YaklangEngineSudo, "remote")
            }
        })
    } catch (e) {
    }
}

const isWindows = process.platform === "win32"

/** @name 生成windows系统的管理员权限命令 */
function generateWindowsSudoCommand(file, args) {
    const cmds = args === "" ? `"'${file}'"` : `"'${file}'" "'${args}'"`
    return `powershell.exe start-process -verb runas -WindowStyle hidden -filepath ${cmds}`
}

/** @name 以管理员权限执行命令 */
function sudoExec(cmd, opt, callback) {
    if (isWindows) {
        childProcess.exec(cmd, {maxBuffer: 1000 * 1000 * 1000}, (err, stdout, stderr) => {
            callback(err)
        })
    } else {
        _sudoPrompt.exec(cmd, {...opt, env: {YAKIT_HOME: path.join(os.homedir(), "yakit-projects/")}}, callback)
    }
}

const engineStdioOutputFactory = (win) => (buf) => {
    if (win) {
        win.webContents.send("live-engine-stdio", buf.toString("utf-8"))
    }
}

const engineLogOutputFactory = (win) => (message) => {
    if (win) {
        console.info(message)
        win.webContents.send("live-engine-log", message + "\n")
    }
}

const ECHO_TEST_MSG = "Hello Yakit!"

module.exports = (win, callback, getClient, newClient) => {
    // 输出到欢迎页面的 output 中
    const toStdout = engineStdioOutputFactory(win)
    // 输出到日志中
    const toLog = engineLogOutputFactory(win)
    // 异步执行 Echo
    const asyncEcho = (params) => {
        return new Promise((resolve, reject) => {
            getClient().Echo(params, (err, data) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(data)
            })
        })
    }

    /** 获取本地引擎版本号 */
    ipcMain.handle("fetch-yak-version", () => {
        try {
            getClient().Version({}, async (err, data) => {
                if (win && data.Version) win.webContents.send("fetch-yak-version-callback", data.Version)
            })
        } catch (e) {
            win.webContents.send("fetch-yak-version-callback", "")
        }
    })

    ipcMain.handle("engine-status", () => {
        try {
            const text = "hello yak grpc engine"
            getClient().Echo({text}, (err, data) => {
                if (win) {
                    if (data?.result === text) {
                        win.webContents.send("client-engine-status-ok")
                    } else {
                        win.webContents.send("client-engine-status-error")
                    }
                }
            })
        } catch (e) {
            if (win) {
                win.webContents.send("client-engine-status-error")
            }
        }
    })

    // asyncGetRandomPort wrapper
    const asyncGetRandomPort = () => {
        return new Promise((resolve, reject) => {
            resolve(40000 + Math.floor(Math.random() * 9999))
        })
    }
    ipcMain.handle("get-random-local-engine-port", async (e) => {
        return await asyncGetRandomPort()
    })

    /**
     * @name 手动启动yaklang引擎进程
     * @param {Object} params
     * @param {Boolean} params.sudo 是否使用管理员权限启动yak
     * @param {Number} params.port 本地缓存数据里的引擎启动端口号
     */
    const asyncStartLocalYakEngineServer = (win, params) => {
        engineCount += 1

        const {sudo, port} = params
        let randPort = port || 40000 + Math.floor(Math.random() * 9999)

        return new Promise((resolve, reject) => {
            try {
                // 考虑如果管理员权限启动未成功该通过什么方式自启普通权限引擎进程
                if (sudo) {
                    if (isWindows) {
                        const subprocess = childProcess.exec(
                            generateWindowsSudoCommand(getLocalYaklangEngine(), `grpc --port ${randPort}`),
                            {maxBuffer: 1000 * 1000 * 1000}
                        )

                        subprocess.on("error", (err) => {
                            if (err) reject(err)
                        })

                        subprocess.on("close", async (e) => {
                            if (e) reject(e)
                        })
                    } else {
                        const cmd = `${getLocalYaklangEngine()} grpc --port ${randPort}`
                        sudoExec(
                            cmd,
                            {
                                name: `yak grpc port ${randPort}`
                            },
                            function (error, stdout, stderr) {
                                if (!!error && error?.code === 137) return

                                if (error || stderr) {
                                    if (error.message.indexOf("User did not grant permission") > -1) {
                                        asyncStartLocalYakEngineServer(win, {sudo: false, port: randPort})
                                    }
                                    reject(error || stderr)
                                }
                            }
                        )
                    }
                } else {
                    toLog("已启动本地引擎进程")
                    const subprocess = childProcess.spawn(getLocalYaklangEngine(), ["grpc", "--port", `${randPort}`], {
                        // stdio: ["ignore", "ignore", "ignore"]
                        stdio: "pipe"
                    })
                    subprocess.stdout.on("data", (stdout) => {
                        toStdout(stdout)
                    })
                    subprocess.stderr.on("data", (stdout) => {
                        toStdout(stdout)
                    })
                    subprocess.on("error", (err) => {
                        toLog(`本地引擎遭遇错误，错误原因为：${err}`)
                        reject(err)
                    })
                    subprocess.on("close", async (e) => {
                        toLog(`本地引擎退出，退出码为：${e}`)
                    })
                    resolve()
                }
            } catch (e) {
                reject(e)
            }
        })
    }

    /** 本地启动yaklang引擎 */
    ipcMain.handle("start-local-yaklang-engine", async (e, params) => {
        if (!params["port"]) {
            throw Error("启动本地引擎必须指定端口")
        }
        return await asyncStartLocalYakEngineServer(win, params)
    })

    /** 判断远程缓存端口是否已开启引擎 */
    const judgeRemoteEngineStarted = (win, params) => {
        return new Promise((resolve, reject) => {
            try {
                testRemoteClient(params, async (err, result) => {
                    if (!err) {
                        GLOBAL_YAK_SETTING.defaultYakGRPCAddr = `${params.host}:${params.port}`
                        GLOBAL_YAK_SETTING.caPem = params.caPem || ""
                        GLOBAL_YAK_SETTING.password = params.password
                        GLOBAL_YAK_SETTING.sudo = false
                        win.webContents.send("start-yaklang-engine-success", "remote")
                        resolve()
                    } else reject(err)
                })
            } catch (e) {
                reject(e)
            }
        })
    }
    /** 远程连接引擎 */
    ipcMain.handle("start-remote-yaklang-engine", async (e, params) => {
        return await judgeRemoteEngineStarted(win, params)
    })

    /** 连接引擎 */
    ipcMain.handle("connect-yaklang-engine", async (e, params) => {
        console.log('info', JSON.stringify(GLOBAL_YAK_SETTING));
        /**
         * connect yaklang engine 实际上是为了设置参数，实际上他是不知道远程还是本地
         * params 中的参数应该有如下：
         *  @Host: 主机名，可能携带端口
         *  @Port: 端口
         *  @Sudo: 是否是管理员权限
         *  @IsTLS?: 是否是 TLS 加密的
         *  @PemBytes?: Uint8Array 是 CaPem
         *  @Password?: 登陆密码
         */
        const hostRaw = `${params["Host"] || "127.0.0.1"}`;
        let portFromRaw = `${params["Port"] || 8087}`
        let hostFormatted = hostRaw;
        if (hostRaw.lastIndexOf(":") >= 0) {
            portFromRaw = `${parseInt(hostRaw.substr(hostRaw.lastIndexOf(":") + 1))}`
            hostFormatted = `${hostRaw.substr(0, hostRaw.lastIndexOf(":"))}`
        }
        const addr = `${hostFormatted}:${portFromRaw}`;
        toLog(`原始参数为: ${JSON.stringify(params)}`)
        toLog(`开始连接引擎地址为：${addr} Host: ${hostRaw} Port: ${portFromRaw}`)
        GLOBAL_YAK_SETTING.defaultYakGRPCAddr = addr

        callback(
            GLOBAL_YAK_SETTING.defaultYakGRPCAddr,
            Buffer.from(params["PemBytes"] === undefined ? "" : params["PemBytes"]).toString("utf-8"),
            params["Password"] || "",
        )
        return (await (new Promise((resolve, reject) => {
            newClient().Echo({text: ECHO_TEST_MSG}, (err, data) => {
                if (err) {
                    reject(err)
                    return
                }
                if (data["result"] === ECHO_TEST_MSG) {
                    resolve(data)
                } else {
                    reject(Error(`ECHO ${ECHO_TEST_MSG} ERROR`))
                }
            })
        })))
    })

    /** 断开引擎(暂未使用) */
    ipcMain.handle("break-yaklalng-engine", () => {
    })

    /** 输出到欢迎界面的日志中 */
    ipcMain.handle("output-log-to-welcome-console", (e, msg) => {
        toLog(`${msg}`)
    })


}
