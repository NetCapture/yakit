import React, {ReactNode, useEffect, useRef, useState, useMemo} from "react"
import styles from "./VirtualTable.module.scss"
import classNames from "classnames"
import {useVirtualList, useThrottleFn} from "ahooks"
import ReactResizeDetector from "react-resize-detector"
import {LoadingOutlined} from "@ant-design/icons"
import {Spin, Popover} from "antd"
import {FilterIcon} from "@/assets/newIcon"

interface VirtualTableTitleProps {
    columns: VirtualColumns[]
}

const VirtualTableTitle: React.FC<VirtualTableTitleProps> = (props) => {
    const {columns} = props
    return (
        <div className={styles["virtual-table-title"]}>
            {columns.map((item) => {
                return (
                    <div
                        style={item?.width ? {width: item.width} : {}}
                        className={classNames({
                            [styles["virtual-table-title-flex"]]: !!!item.width,
                            [styles["virtual-table-title-item"]]: !!!item?.filterProps,
                            [styles["virtual-table-title-filter"]]: !!item?.filterProps
                        })}
                    >
                        <div
                            className={classNames({
                                [styles["virtual-table-title-item"]]: !!item?.filterProps
                            })}
                        >
                            {item.title}
                        </div>
                        {item?.filterProps && (
                            <Popover
                                placement='bottom'
                                trigger='click'
                                content={<div>666</div>}
                                // overlayClassName={style["search-popover"]}
                                // visible={opensPopover[filterKey]}
                            >
                                <div
                                    onClick={() => {}}
                                    className={classNames(styles["virtual-table-title-filter-icon"])}
                                >
                                    <FilterIcon />
                                </div>
                            </Popover>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

interface VirtualTableContentProps {
    columns: VirtualColumns[]
    dataSource: any[]
    loading?: boolean
    hasMore: boolean
    page: number
    defItemHeight: number
    defOverscan?: number
}

const VirtualTableContent: React.FC<VirtualTableContentProps> = (props) => {
    const {columns, dataSource, loading, hasMore, page, defItemHeight, defOverscan} = props
    const containerRef = useRef(null)
    const wrapperRef = useRef(null)

    const [vlistWidth, setVListWidth] = useState(260)
    const [vlistHeigth, setVListHeight] = useState(600)

    const originalList: any = useMemo(() => Array.from(Array(99999).keys()), [])

    const [list] = useVirtualList(originalList, {
        containerTarget: containerRef,
        wrapperTarget: wrapperRef,
        itemHeight: defItemHeight,
        overscan: defOverscan || 5
    })

    const onScrollCapture = useThrottleFn(
        () => {
            if (wrapperRef && containerRef && !loading && hasMore) {
                const dom = containerRef.current || {
                    scrollTop: 0,
                    clientHeight: 0,
                    scrollHeight: 0
                }
                const contentScrollTop = dom.scrollTop //滚动条距离顶部
                const clientHeight = dom.clientHeight //可视区域
                const scrollHeight = dom.scrollHeight //滚动条内容的总高度
                const scrollBottom = scrollHeight - contentScrollTop - clientHeight
                if (scrollBottom <= 500) {
                    console.log("获取数据的方法")
                    // loadMoreData() // 获取数据的方法
                }
            }
        },
        {wait: 200, leading: false}
    )

    return (
        <div className={styles["virtual-table-content"]}>
            <ReactResizeDetector
                onResize={(width, height) => {
                    if (!width || !height) {
                        return
                    }
                    setVListWidth(width - 90)
                    setVListHeight(height)
                }}
                handleWidth={true}
                handleHeight={true}
                refreshMode={"debounce"}
                refreshRate={50}
            />
            <div
                ref={containerRef}
                style={{height: vlistHeigth, overflow: "overlay"}}
                onScroll={() => onScrollCapture.run()}
            >
                <div ref={wrapperRef}>
                    {list.map((ele) => (
                        <div className={styles["virtual-table-content-list"]} key={ele.index}>
                            {columns.map((item) => {
                                return (
                                    <div
                                        style={item?.width ? {width: item.width} : {}}
                                        className={classNames(styles["virtual-table-content-item"], {
                                            [styles["virtual-table-content-flex"]]: !!!item.width
                                        })}
                                    >
                                        {/* {item?.render ? item.render(ele["dataIndex"] || undefined, list) : "test"} */}
                                        {
                                            !!!item.dataIndex&&item?.render?item.render():"test"
                                        }
                                    </div>
                                )
                            })}
                            {/* Row: {ele.data} */}
                        </div>
                    ))}
                    {loading && hasMore && (
                        <div className='grid-block text-center'>
                            <LoadingOutlined />
                        </div>
                    )}
                    {!loading && !hasMore && (page || 0) > 0 && (
                        <div className='grid-block text-center no-more-text'>暂无更多数据</div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface TableTitleFilter {
    filterRender?: () => ReactNode
}

export interface VirtualColumns {
    title: ReactNode
    dataIndex?: string
    render?: (item?: any, all?: any) => ReactNode
    width?: number
    filterProps?: TableTitleFilter
}

interface VirtualTableProps {
    loading?: boolean
    className?: string
    columns: VirtualColumns[]
    dataSource: any[]
}

export const VirtualTable: React.FC<VirtualTableProps> = (props) => {
    const {loading, className, columns, dataSource} = props
    return (
        <div className={classNames(styles["virtual-table"], className)}>
            <VirtualTableTitle columns={columns} />
            <VirtualTableContent
                page={1}
                columns={columns}
                dataSource={dataSource}
                loading={loading}
                hasMore={true}
                defItemHeight={44}
            />
        </div>
    )
}
