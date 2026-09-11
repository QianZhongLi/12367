#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键合成单文件版 HTML
从 港澳出入境有效天数计算器.htm 读取，内联所有 JS/CSS，压缩图片后转 base64
输出到 index.html，并压缩为 index.zip
"""

import base64
import io
import os
import re
import sys
import zipfile

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    print("Warning: Pillow not installed, images will not be compressed.")
    print("  Install with: pip install Pillow")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_HTML = os.path.join(BASE_DIR, '港澳出入境有效天数计算器.htm')
OUTPUT_HTML = os.path.join(BASE_DIR, 'index.html')
OUTPUT_ZIP = os.path.join(BASE_DIR, 'index.zip')
FILES_DIR = os.path.join(BASE_DIR, '港澳出入境有效天数计算器_files')
IMG_DIR = os.path.join(BASE_DIR, '截图')

def minify_html(html):
    """压缩 HTML：移除注释和多余空白，保护 pre/script/style/textarea 内容"""
    protected = []
    def protect(match):
        protected.append(match.group(0))
        return f'__PROTECTED_{len(protected)-1}__'
    # 保护特殊标签内容
    html = re.sub(r'<(pre|script|style|textarea)[^>]*>.*?</\1>', protect, html, flags=re.DOTALL | re.IGNORECASE)
    # 移除 HTML 注释
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # 压缩标签间空白
    html = re.sub(r'>\s+<', '><', html)
    # 压缩行内多余空白
    html = re.sub(r'\s+', ' ', html)
    # 恢复保护内容
    for i, content in enumerate(protected):
        html = html.replace(f'__PROTECTED_{i}__', content)
    return html.strip()

def minify_css(css):
    """压缩 CSS：移除注释和多余空白"""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r';\s*}', '}', css)
    css = re.sub(r'\{\s+', '{', css)
    css = re.sub(r',\s+', ',', css)
    css = re.sub(r':\s+', ':', css)
    css = re.sub(r';\s+', ';', css)
    css = re.sub(r'}\s+', '}', css)
    return css.strip()

def minify_js(js):
    """压缩 JS：安全地移除多行注释和压缩空白"""
    # 移除多行注释（尽可能安全：非贪婪匹配）
    js = re.sub(r'/\*.*?\*/', '', js, flags=re.DOTALL)
    # 移除单行注释（简单正则，有风险但对现有代码够用）
    lines = []
    for line in js.split('\n'):
        # 移除行尾注释，但保护字符串内的 //
        stripped = re.sub(r'(?<![:"\'])//.*$', '', line)
        lines.append(stripped)
    js = '\n'.join(lines)
    # 压缩多余空白
    js = re.sub(r'\n\s*\n', '\n', js)
    js = re.sub(r'[ \t]+', ' ', js)
    return js.strip()

def compress_image(img_path, quality=60):
    """压缩图片为 JPEG，返回压缩后的字节"""
    if not PILLOW_AVAILABLE:
        with open(img_path, 'rb') as f:
            return f.read()
    
    img = Image.open(img_path)
    # 如果是 RGBA 模式，先转 RGB（JPEG 不支持透明）
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=quality, optimize=True)
    compressed = buf.getvalue()
    
    original_size = os.path.getsize(img_path)
    compressed_size = len(compressed)
    ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
    
    return compressed, original_size, compressed_size, ratio

def inline_resource(html, pattern, replacer):
    """通用内联替换"""
    def do_replace(match):
        return replacer(match)
    return re.sub(pattern, do_replace, html, flags=re.IGNORECASE)

def build():
    if not os.path.exists(SOURCE_HTML):
        print(f"Error: Source file not found: {SOURCE_HTML}")
        sys.exit(1)
    
    with open(SOURCE_HTML, 'r', encoding='utf-8') as f:
        html = f.read()
    
    print("=== 港澳出入境有效天数计算器 — 单文件合成脚本 ===\n")
    
    # 1. 内联 CSS
    css_pattern = r'<link\s+rel="stylesheet"\s+href="\.\/港澳出入境有效天数计算器_files\/style\.css"\s*/?>'
    css_path = os.path.join(FILES_DIR, 'style.css')
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            css = f.read()
        css = minify_css(css)
        def css_repl(m):
            return f'<style>\n{css}\n</style>'
        html = re.sub(css_pattern, css_repl, html, flags=re.IGNORECASE)
        print(f"[CSS] 已内联 style.css ({len(css)} chars)")
    else:
        print(f"[CSS] Warning: style.css not found")
    
    # 2. 内联 JS 文件（按顺序）
    js_files = ['pdf.min.js', 'holidays.js', 'ports.js', 'calculator.js', 'app.js']
    for js_name in js_files:
        js_path = os.path.join(FILES_DIR, js_name)
        pattern = rf'<script\s+src="\.\/港澳出入境有效天数计算器_files\/{re.escape(js_name)}"><\/script>'
        if os.path.exists(js_path):
            with open(js_path, 'r', encoding='utf-8') as f:
                js = f.read()
            if js_name != 'pdf.min.js':
                js = minify_js(js)
            def js_repl(m, content=js):
                return f'<script>\n{content}\n</script>'
            html = re.sub(pattern, js_repl, html, flags=re.IGNORECASE)
            print(f"[JS]  已内联 {js_name} ({len(js)} chars)")
        else:
            print(f"[JS]  Warning: {js_name} not found")
    
    # 3. 处理图片：先压缩，再转 base64
    print("\n--- 图片处理 ---")
    total_orig = 0
    total_comp = 0
    total_b64 = 0
    
    # 收集截图目录下所有 jpg 文件
    img_files = sorted([f for f in os.listdir(IMG_DIR) if f.lower().endswith('.jpg')])
    total_imgs = len(img_files)
    
    for idx, filename in enumerate(img_files, 1):
        img_path = os.path.join(IMG_DIR, filename)
        old_src = f'./截图/{filename}'
        
        if not os.path.exists(img_path):
            print(f"[{idx}/{total_imgs}] Warning: {img_path} not found, skipping")
            continue
        
        if PILLOW_AVAILABLE:
            compressed, orig_size, comp_size, ratio = compress_image(img_path, quality=60)
            total_orig += orig_size
            total_comp += comp_size
            b64 = base64.b64encode(compressed).decode('ascii')
            total_b64 += len(b64)
            print(f"[{idx}/{total_imgs}] {filename}: 原图 {orig_size/1024:.1f} KB -> 压缩后 {comp_size/1024:.1f} KB (省 {ratio:.1f}%) -> base64 {len(b64)/1024:.1f} KB")
        else:
            with open(img_path, 'rb') as f:
                data = f.read()
            total_orig += len(data)
            total_comp += len(data)
            b64 = base64.b64encode(data).decode('ascii')
            total_b64 += len(b64)
            print(f"[{idx}/{total_imgs}] {filename}: {len(data)/1024:.1f} KB -> base64 {len(b64)/1024:.1f} KB (未压缩)")
        
        data_uri = f'data:image/jpeg;base64,{b64}'
        html = html.replace(old_src, data_uri)
    
    # 4. Minify
    print("\n--- 代码压缩 ---")
    html_before = len(html)
    html = minify_html(html)
    html_after = len(html)
    print(f"HTML: {html_before} -> {html_after} chars (省 {html_before-html_after} chars)")
    
    # 5. 写入输出文件
    with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html)
    
    out_size = os.path.getsize(OUTPUT_HTML)
    
    # 6. 压缩为 zip
    with zipfile.ZipFile(OUTPUT_ZIP, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(OUTPUT_HTML, os.path.basename(OUTPUT_HTML))
    zip_size = os.path.getsize(OUTPUT_ZIP)
    
    # 7. 自动备份
    backup_dir = os.path.join(BASE_DIR, 'backup')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_html = os.path.join(backup_dir, f'index_{timestamp}.html')
    backup_zip = os.path.join(backup_dir, f'index_{timestamp}.zip')
    
    import shutil
    shutil.copy2(OUTPUT_HTML, backup_html)
    shutil.copy2(OUTPUT_ZIP, backup_zip)
    
    print(f"\n=== 合成完成 ===")
    print(f"HTML文件: {OUTPUT_HTML} ({out_size/1024:.1f} KB)")
    print(f"ZIP文件:  {OUTPUT_ZIP} ({zip_size/1024:.1f} KB)")
    print(f"备份目录: {backup_dir}")
    print(f"  -> {os.path.basename(backup_html)}")
    print(f"  -> {os.path.basename(backup_zip)}")
    print(f"图片原图总计: {total_orig/1024:.1f} KB")
    print(f"图片压缩后总计: {total_comp/1024:.1f} KB (节省 {(1-total_comp/total_orig)*100:.1f}%)")
    print(f"base64 编码后总计: {total_b64/1024:.1f} KB")

if __name__ == '__main__':
    build()
