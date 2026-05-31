import re

with open('miniprogram/pages/admin/orders.wxss', 'r', encoding='utf-8') as f:
    content = f.read()

# 我们需要找到所有按钮样式定义，只保留最后一组（最新的）
# 使用正则表达式找到所有按钮相关的样式块

# 定义要保留的按钮样式（最后修改的版本）
new_button_styles = """
.order-btns { 
  display: flex; 
  gap: 16rpx; 
}

.btn-take { 
  flex: 3;
  background: #007AFF; 
  color: #fff; 
  border: none; 
  border-radius: 12rpx; 
  font-size: 34rpx; 
  padding: 0 48rpx; 
  font-weight: 500; 
  height: 84rpx;
  line-height: 84rpx;
}

.btn-cancel { 
  flex: 1;
  background: #fff; 
  color: #FF3B30; 
  border: 2rpx solid #FF3B30; 
  border-radius: 12rpx; 
  font-size: 30rpx; 
  padding: 0 32rpx; 
  height: 84rpx;
  line-height: 84rpx;
}

.btn-take:active { 
  background: #0066CC; 
}

.btn-cancel:active { 
  background: #FFF5F5; 
}
"""

# 删除所有旧的按钮样式定义
# 匹配从 .order-btns 到下一个非按钮样式的所有内容
pattern = r'\.order-btns\s*\{[^}]*\}\s*(\.btn-take[^}]*\}\s*)*(\.btn-cancel[^}]*\}\s*)*(\.btn-take:active[^}]*\}\s*)*(\.btn-cancel:active[^}]*\}\s*)*(\.btn-undo[^}]*\}\s*)*(\.btn-undo:active[^}]*\}\s*)*'

# 更简单的方法：找到所有按钮样式块并替换
lines = content.split('\n')
in_button_section = False
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # 检测按钮样式区域的开始
    if '.order-btns' in line or '.btn-take' in line or '.btn-cancel' in line or '.btn-take:active' in line or '.btn-cancel:active' in line or '.btn-undo' in line or '.btn-undo:active' in line:
        if not in_button_section:
            # 第一次遇到按钮样式，添加新的样式
            new_lines.append(new_button_styles)
            in_button_section = True
        # 跳过所有按钮样式行
        while i < len(lines) and ('.order-btns' in lines[i] or '.btn-take' in lines[i] or '.btn-cancel' in lines[i] or '.btn-take:active' in lines[i] or '.btn-cancel:active' in lines[i] or '.btn-undo' in lines[i] or '.btn-undo:active' in lines[i]):
            i += 1
        continue
    else:
        in_button_section = False
        new_lines.append(line)
        i += 1

# 写入新文件
with open('miniprogram/pages/admin/orders.wxss', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print("WXSS cleaned successfully")
