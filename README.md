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

## 构建

安装 Pillow 后运行：

```powershell
python -m pip install Pillow
python .\build_single_file.py
```

构建脚本会生成单文件 `index.html`、`index.zip`，并在本地 `backup/` 保存构建备份。压缩包和备份不会提交到 Git。

## 当前版本校验

2026-09-12 核对时，线上页面、本目录 `index.html` 和构建脚本重新生成的文件完全一致：

```text
SHA-256: 993B76783BFA3F0DA39EE7FC2AF8B0DE4D7D370E37F3230B1D58A665B1E2722F
Size:    2,053,786 bytes
```

