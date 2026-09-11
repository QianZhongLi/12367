# 港澳逗留有效天数计算器

用于解析国家移民管理局 12367 微信小程序导出的出入境记录 PDF，并分别统计澳门、香港及其他留学地区的有效逗留天数。

## 在线版本

https://12367.pages.dev/

项目完全在浏览器本地处理 PDF，记录不会上传到服务器。

## 项目结构

- `index.html`：当前线上使用的单文件版本，可直接部署到 Cloudflare Pages。
- `港澳出入境有效天数计算器.htm`：可维护的 HTML 源文件。
- `港澳出入境有效天数计算器_files/`：JavaScript、CSS 与 PDF 解析依赖。
- `截图/`：使用说明图片，构建时会压缩并内联。
- `build_single_file.py`：生成 `index.html` 与上传用 `index.zip`。
- `PROJECT-NOTES.md`：当前版本的功能与修复记录。
- `DESIGN.md`：蓝白控制台界面的视觉规范。

## 构建

安装 Pillow 后运行：

```powershell
python -m pip install Pillow
python .\build_single_file.py
```

构建脚本会生成单文件 `index.html`、`index.zip`，并在本地 `backup/` 保存构建备份。压缩包和备份不会提交到 Git。

## 当前版本校验

2026-09-12 完成阿里云蓝白控制台风格改版后，本目录构建产物为：

```text
SHA-256: 046CCB0D3A0C98FCCD8DFE1C3F7423E0068B61AAE5595376CF2D1375B29D21A5
Size:    2,062,433 bytes
```
