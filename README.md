# 史昊灵 · Haoling Shi

个人主页：[https://shihaoling.github.io/](https://shihaoling.github.io/)

使用原生 HTML、CSS 和 JavaScript，GitHub Pages 从 `main` 分支根目录发布，无需构建。`scripts/profile.js` 集中管理个人资料、经历、论文、访问记录和想去的地点；`currentBase` 管理首页常驻城市。

- `index.html`：页面结构
- `styles/`：布局和响应式样式
- `scripts/`：内容与交互
- `assets/`：照片、海面背景及地图资源
- `.nojekyll`：静态文件直接发布

地图来源：Natural Earth（https://www.naturalearthdata.com/）和 GeoJSON.CN 的天地图派生数据（https://geojson.cn/data/atlas/tiandi）。中国边界与境界线来源说明保留在 `assets/china-boundary.js` 中，页面底部附地图资料链接。海面背景为本项目生成图像。

2026 年改版前的版本保存在 `backup-before-homepage-20261024` 分支；旧版其他文件仍保留。本次上传仅包含个人主页公开内容。
