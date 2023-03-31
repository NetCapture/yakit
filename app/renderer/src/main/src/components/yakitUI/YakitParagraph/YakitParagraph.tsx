import React, {useState} from "react"
import {YakitParagraphProps} from "./YakitParagraphType"

import classNames from "classnames"
import styles from "./YakitParagraph.module.scss"

export const YakitParagraph: React.FC<YakitParagraphProps> = React.memo((props) => {
    const {content, row = 3, lineHeight = 20, style, className} = props

    const [isExpand, setisExpand] = useState<boolean>(false)

    return (
        <div>
            <div
                style={style}
                className={isExpand ? styles["yakit-expand-wrapper"] : styles["yakit-paragraph-wrapper"]}
            >
                {`提到 文本环绕效果，一般能想到 浮动\nfloat，没错，千万不要以为浮动已经是过去式了，具体的场景还是很有用的。比如下面放一个按钮，然后设置浮动 提到\n文本环绕效果，一般能想到 浮动\nfloat，没错，千万不要以为浮动已经是过去式了，具体的场景还是很有用的。比如下面放一个按钮，然后设置浮动`}
            </div>
            {isExpand && (
                <div className={styles["collapse-wrapper"]} onClick={() => setisExpand(false)}>
                    收起
                </div>
            )}
            {!isExpand && (
                <div className={styles["expand-wrapper"]} onClick={() => setisExpand(true)}>
                    展开
                </div>
            )}
        </div>
    )
})
