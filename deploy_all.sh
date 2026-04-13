#!/bin/bash

# 设置环境 ID（请确保 ID 正确）
ENV_ID="cloudbase-2gjs1hdd0c429545"
# 云函数根目录
FUNCTIONS_DIR="cloudfunctions"

echo "🚀 开始批量部署云函数到环境: $ENV_ID"

# 检查目录是否存在
if [ ! -d "$FUNCTIONS_DIR" ]; then
    echo "❌ 错误: 找不到目录 $FUNCTIONS_DIR"
    exit 1
fi

# 进入云函数根目录
cd $FUNCTIONS_DIR

# 遍历所有文件夹
for dir in */ ; do
    # 去掉末尾的斜杠
    func_name=${dir%/}
    
    echo "------------------------------------------"
    echo "📦 处理云函数: $func_name"
    
    # 检查是否有 package.json
    if [ -f "$dir/package.json" ]; then
        echo "⏩ 发现 package.json，跳过安装（依赖已共享），直接部署..."
        tcb fn deploy $func_name -e $ENV_ID --force -m "--upload-functions"
    else
        echo "⏩ 无 package.json，直接部署..."
        tcb fn deploy $func_name -e $ENV_ID --force -m "--upload-functions"
    fi
done

echo "------------------------------------------"
echo "🎉 所有云函数处理完毕！"