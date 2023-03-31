import {CSSProperties} from "react"

export interface YakitParagraphProps {
    content: string
    row?: number
    lineHeight?: number

    style?: CSSProperties
    className?: string
}
