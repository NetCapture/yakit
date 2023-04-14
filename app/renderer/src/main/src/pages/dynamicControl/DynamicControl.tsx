import React, {ReactNode, useEffect, useRef, useState} from "react"
import {Table, Space, Button, Input, Modal, Form, Radio, Avatar, Spin} from "antd"
import {} from "@ant-design/icons"
import {API} from "@/services/swagger/resposeType"
import {callCopyToClipboard} from "@/utils/basic"
import {useGetState, useMemoizedFn} from "ahooks"
import moment from "moment"
import {failed, success, warn} from "@/utils/notification"
import {NetWorkApi} from "@/services/fetch"
import {showModal} from "@/utils/showModal"
import {PaginationSchema} from "@/pages/invoker/schema"
import type {ColumnsType} from "antd/es/table"
import {ControlMyselfIcon, ControlOtherIcon} from "@/assets/icons"
import styles from "./DynamicControl.module.scss"
import {YakitButton} from "@/components/yakitUI/YakitButton/YakitButton"
import {ContentUploadInput} from "@/components/functionTemplate/ContentUploadTextArea"
import {YakitRadioButtons} from "@/components/yakitUI/YakitRadioButtons/YakitRadioButtons"
import {YakitInput} from "@/components/yakitUI/YakitInput/YakitInput"
import {VirtualTable} from "./VirtualTable"
import {QueryYakScriptRequest, QueryYakScriptsResponse, YakScript} from "../invoker/schema"
import {VirtualColumns} from "./VirtualTable"
const {TextArea} = Input
const {ipcRenderer} = window.require("electron")
export interface ControlOperationProps {}

// 控制中 - 禁止操作
export const ControlOperation: React.FC<ControlOperationProps> = (props) => {
    // 关闭远程控制
    const closeControl = () => {}
    return (
        <div className={styles["control-operation"]}>
            <div className={styles["control-operation-box"]}>
                <div className={styles["control-operation-title"]}>远程控制中</div>
                <div className={styles["control-operation-seconend-title"]}>
                    已被用户 Alex-null 远程控制，请勿关闭 Yakit
                </div>
                <div className={styles["control-operation-img"]}>
                    <ControlMyselfIcon />
                </div>
                <YakitButton
                    onClick={closeControl}
                    size='max'
                    type='danger'
                    className={styles["control-operation-btn"]}
                >
                    退出远程
                </YakitButton>
                <div className={styles["control-operation-left-bg"]}></div>
                <div className={styles["control-operation-right-bg"]}></div>
            </div>
        </div>
    )
}

export interface ControlMyselfProps {
    goBack: () => void
}

// 受控端
export const ControlMyself: React.FC<ControlMyselfProps> = (props) => {
    const {goBack} = props
    return (
        <div className={styles["control-myself"]}>
            <TextArea className={styles["text-area"]} autoSize={{minRows: 3, maxRows: 10}} disabled />
            <div className={styles["btn-box"]}>
                <YakitButton type='outline2' style={{marginRight: 8}} onClick={goBack}>
                    返回上一步
                </YakitButton>
                <YakitButton>复制密钥</YakitButton>
            </div>
        </div>
    )
}

export interface ControlOtherProps {
    goBack: () => void
}

// 控制端
export const ControlOther: React.FC<ControlOtherProps> = (props) => {
    const {goBack} = props
    const [textAreaValue, setTextAreaValue] = useState<string>("")
    const [uploadLoading, setUploadLoading] = useState<boolean>(false)
    return (
        <div className={styles["control-other"]}>
            <Spin spinning={uploadLoading}>
                <ContentUploadInput
                    type='textarea'
                    beforeUpload={(f) => {
                        const typeArr: string[] = [
                            "text/plain",
                            ".csv",
                            ".xls",
                            ".xlsx",
                            "application/vnd.ms-excel",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        ]
                        if (!typeArr.includes(f.type)) {
                            failed(`${f.name}非txt、Excel文件，请上传txt、Excel格式文件！`)
                            return false
                        }

                        setUploadLoading(true)
                        ipcRenderer.invoke("fetch-file-content", (f as any).path).then((res) => {
                            let Targets = res
                            // 处理Excel格式文件
                            if (f.type !== "text/plain") {
                                let str = JSON.stringify(res)
                                Targets = str.replace(/(\[|\]|\{|\}|\")/g, "")
                            }
                            setTextAreaValue(Targets)
                            setTimeout(() => setUploadLoading(false), 100)
                        })
                        return false
                    }}
                    item={{help: <></>}}
                    textarea={{
                        className: "text-area",
                        isBubbing: true,
                        setValue: (value) => setTextAreaValue(value),
                        value: textAreaValue,
                        autoSize: {minRows: 3, maxRows: 10},
                        placeholder: "请将链接密钥粘贴/输入到文本框中"
                    }}
                />
            </Spin>
            <div className={styles["btn-box"]}>
                <YakitButton type='outline2' style={{marginRight: 8}} onClick={goBack}>
                    返回上一步
                </YakitButton>
                <YakitButton disabled={textAreaValue.length === 0}>远程连接</YakitButton>
            </div>
        </div>
    )
}

export interface SelectControlTypeProps {
    onControlMyself: (v: boolean) => void
    onControlOther: (v: boolean) => void
}

// 控制模式选择
export const SelectControlType: React.FC<SelectControlTypeProps> = (props) => {
    const {onControlMyself, onControlOther} = props
    return (
        <div className={styles["select-control-type"]}>
            <div className={styles["type-box"]} onClick={() => onControlMyself(true)}>
                <div className={styles["type-img"]}>
                    <ControlMyselfIcon />
                </div>
                <div className={styles["type-content"]}>
                    <div className={styles["type-title"]}>受控端</div>
                    <div className={styles["type-text"]}>生成邀请密钥</div>
                </div>
            </div>
            <div className={styles["type-box"]} onClick={() => onControlOther(true)}>
                <div className={styles["type-img"]}>
                    <ControlOtherIcon />
                </div>
                <div className={styles["type-content"]}>
                    <div className={styles["type-title"]}>控制端</div>
                    <div className={styles["type-text"]}>可通过受控端分享的密钥远程控制他的 Yakit</div>
                </div>
            </div>
        </div>
    )
}

export interface DynamicControlProps {
    isShow: boolean
    onCancle: () => void
    mainTitle: string
    secondTitle: string
    children?: React.ReactNode
    width?: number
}

export const DynamicControl: React.FC<DynamicControlProps> = (props) => {
    const {isShow, onCancle, children, mainTitle, secondTitle, width} = props
    return (
        <Modal
            visible={isShow}
            destroyOnClose={true}
            maskClosable={false}
            bodyStyle={{padding: "18px 24px 24px 24px"}}
            width={width || 448}
            onCancel={() => onCancle()}
            footer={null}
            centered
        >
            <div className={styles["dynamic-control"]}>
                <div className={styles["title-box"]}>
                    <div className={styles["main-title"]}>{mainTitle}</div>
                    <div className={styles["second-title"]}>{secondTitle}</div>
                </div>
                {children}
            </div>
        </Modal>
    )
}

export interface ShowUserInfoProps extends API.NewUrmResponse {
    onClose: () => void
}
const ShowUserInfo: React.FC<ShowUserInfoProps> = (props) => {
    const {user_name, password, onClose} = props
    const copyUserInfo = () => {
        callCopyToClipboard(`用户名：${user_name}\n密码：${password}`)
    }
    return (
        <div style={{padding: "0 10px"}}>
            <div>
                用户名：<span>{user_name}</span>
            </div>
            <div>
                密码：<span>{password}</span>
            </div>
            <div style={{textAlign: "center", paddingTop: 10}}>
                <Button type='primary' onClick={() => copyUserInfo()}>
                    复制
                </Button>
            </div>
        </div>
    )
}

export interface ControlAdminPageProps {}
export interface AccountAdminPageProp {}

export interface QueryExecResultsParams {
    keywords: string
}
interface QueryProps {}

export const ControlAdminPage: React.FC<ControlAdminPageProps> = (props) => {
    const [loading, setLoading] = useState<boolean>(false)
    const [params, setParams, getParams] = useGetState<QueryExecResultsParams>({
        keywords: ""
    })
    const [pagination, setPagination] = useState<PaginationSchema>({
        Limit: 20,
        Order: "desc",
        OrderBy: "updated_at",
        Page: 1
    })
    const [data, setData] = useState<API.UrmUserList[]>([])
    const [total, setTotal] = useState<number>(0)
    const [radioValue, setRadioValue] = useState<string>("成员管理")

    const [hasMore, setHasMore] = useState(false)
    const [response, setResponse] = useState<QueryYakScriptsResponse>({
        Data: [],
        Pagination: {
            Limit: 20,
            Page: 0,
            Order: "desc",
            OrderBy: "updated_at"
        },
        Total: 0
    })

    const update = (page?: number, limit?: number, order?: string, orderBy?: string) => {
        setLoading(true)
        const paginationProps = {
            page: page || 1,
            limit: limit || pagination.Limit
        }

        NetWorkApi<QueryProps, API.UrmUserListResponse>({
            method: "get",
            url: "urm",
            params: {
                ...params,
                ...paginationProps
            }
        })
            .then((res) => {
                const newData = res.data.map((item) => ({...item}))
                console.log("数据源：", newData)
                setData(newData)
                setPagination({...pagination, Limit: res.pagemeta.limit})
                setTotal(res.pagemeta.total)
            })
            .catch((err) => {
                failed("获取账号列表失败：" + err)
            })
            .finally(() => {
                setTimeout(() => {
                    setLoading(false)
                }, 200)
            })
    }

    useEffect(() => {
        // setTest(true)
        update()
    }, [])

    const judgeAvatar = (record) => {
        const {head_img, user_name} = record
        return head_img && !!head_img.length ? (
            <Avatar size={32} src={head_img} />
        ) : (
            <Avatar size={32} style={{backgroundColor: "rgb(245, 106, 0)"}}>
                {user_name.slice(0, 1)}
            </Avatar>
        )
    }

    const copySecretKey = () => {}

    const memberColumns: VirtualColumns[] = [
        {
            title: "姓名",
            dataIndex: "user_name",
            render: (text: string, record) => (
                <div>
                    {judgeAvatar(record)}
                    <span style={{marginLeft: 10}}>{text}</span>
                </div>
            )
        },
        {
            title: "远程地址",
            dataIndex: "created_at0",
            render: (text) => <span></span>
        },
        {
            title: "操作",
            render: (i) => (
                <div className={styles["copy-password"]} onClick={() => copySecretKey()}>复制密钥</div>
            ),
            width: 100
        }
    ]

    const columns: VirtualColumns[] = [
        {
            title: "控制端",
            dataIndex: "user_name",
            render: (text: string, record) => (
                <div>
                    {judgeAvatar(record)}
                    <span style={{marginLeft: 10}}>{text}</span>
                </div>
            )
        },
        {
            title: "远程地址",
            dataIndex: "created_at0",
            render: (text) => <span></span>
        },
        {
            title: "开始时间",
            dataIndex: "created_at",
            render: (text) => <span>{moment.unix(text).format("YYYY-MM-DD HH:mm")}</span>
        },
        {
            title: "结束时间",
            dataIndex: "created_at1",
            render: (text) => <span>{moment.unix(text).format("YYYY-MM-DD HH:mm")}</span>
        },
        {
            title: "状态",
            render: (i) => (
                <div className={styles["radio-status"]}>
                    <Radio className={styles["radio-status-active"]} defaultChecked={true}>远程中</Radio>
                    {/* <Radio disabled={true}>已结束</Radio> */}
                </div>   
                
            ),
            width: 100,
            filterProps: {
                filterRender: () => <div></div>
            }
        }
    ]
    return (
        <div className={styles["control-admin-page"]}>
            <div className={styles["operation"]}>
                <div className={styles["left-select"]}>
                    <div className={styles["radio-box"]}>
                        <YakitRadioButtons
                            value={radioValue}
                            onChange={(e) => {
                                setRadioValue(e.target.value)
                            }}
                            buttonStyle='solid'
                            size='middle'
                            options={[
                                {
                                    value: "成员管理",
                                    label: "成员管理"
                                },
                                {
                                    value: "进程管理",
                                    label: "进程管理"
                                }
                            ]}
                        />
                    </div>

                    <span className={styles["total-box"]}>
                        <span className={styles["title"]}>Total</span> <span className={styles["content"]}>30</span>
                    </span>
                </div>

                <div className={styles["right-filter"]}>
                    <YakitInput.Search
                        placeholder={"请输入用户名"}
                        enterButton={true}
                        size='middle'
                        style={{width: 200}}
                        value={params.keywords}
                        onChange={(e) => {
                            setParams({...getParams(), keywords: e.target.value})
                        }}
                        onSearch={() => {
                            update()
                        }}
                    />
                </div>
            </div>
            <div className={styles["virtual-table-box"]}>
                {radioValue === "成员管理" ? (
                    <VirtualTable loading={loading} columns={memberColumns} dataSource={data} />
                ) : (
                    <VirtualTable loading={loading} columns={columns} dataSource={data} />
                )}
            </div>
            {/* <Table
                loading={loading}
                pagination={{
                    size: "small",
                    defaultCurrent: 1,
                    pageSize: pagination?.Limit || 10,
                    showSizeChanger: true,
                    total,
                    showTotal: (i) => <Tag>{`Total ${i}`}</Tag>,
                    onChange: (page: number, limit?: number) => {
                        update(page, limit)
                    }
                }}
                rowKey={(row) => row.uid}
                columns={columns}
                size={"small"}
                bordered={true}
                dataSource={data}
            /> */}
        </div>
    )
}
