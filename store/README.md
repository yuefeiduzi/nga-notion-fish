# store/ —— 上架素材与流程

这个目录**不参与扩展运行**，只放「发到商店」要用的东西：图标生成、打包脚本、商品页素材与文案。
代码在 `../extension/`。

## 文件

| 文件 | 作用 |
| --- | --- |
| `pack.sh` | 打包上架 zip → `dist/nga-reader-<版本>.zip`（manifest.json 在包根） |
| `make-icons.py` | 生成 `extension/icons/{16,32,48,128}.png`（与伪装 favicon 同一枚造型，别用 NGA 官方图） |
| `make-listing-images.py` | 生成小宣传图 440×280 与 Edge logo 300×300 |
| `images/` | 商品页截图（1280×800）与上面两张品牌图 |
| `listing.md` | 商店文案、权限理由、隐私披露口径、给审核员的说明 |

## 发一版新版本

```bash
# 1. 改 extension/manifest.json 的 version（两家都拒绝重复版本号）
# 2. 本地验证：chrome://extensions 重新加载 + 按 dev/README.md 的清单过一遍
bash store/pack.sh                      # 3. 打包
# 4. 两个后台各自上传这个 zip、改「新版本说明」、提交审核
```

图标与品牌图改了造型时：

```bash
python3 store/make-icons.py             # → extension/icons/*.png（会随包提交）
python3 store/make-listing-images.py    # → store/images/{promo-440x280,logo-300x300}.png
```

商品页截图（1280×800）是真浏览器拍的，做法：起样例服务器 → 浏览器窗口设成 1280×800 →
**先在设置里清空「最近浏览」**（别把真人浏览记录截进去）→ 分别截「阅读页（默认无图模式）」
「图片模式」「深色」「板块列表」。文件命名见 `listing.md` 的素材清单。

## 第一次提交前的清单

- [ ] `extension/icons/` 四张图标已生成、manifest 的 `icons`/`action.default_icon` 指对了
- [ ] 仓库根目录有 `LICENSE` 与 `PRIVACY.md`，隐私政策 URL 指向公开链接（GitHub blob 即可）
- [ ] `store/listing.md` 的文案按当前功能核对过一遍（尤其权限理由与数据披露）
- [ ] Test instructions 已填：说明「需要 NGA 登录」+ 演示页地址（`chrome-extension://<ID>/demo/index.html`）
- [ ] 演示页能跑通：`chrome://extensions` 里加载扩展后打开上面那个地址，点「显示图片」有反应
- [ ] Chrome：账号开两步验证、付一次性 $5 注册费、填 Trader/Non-Trader（免费无内购选 Non-Trader）
- [ ] Edge：Partner Center 注册；注意注册信息（开发者名 / 网站 / 支持联系方式）会公示在商品页

## 审核时的常见提问与我们的答案

| 审核会问 | 回答 |
| --- | --- |
| 为什么需要 NGA 域名的 host 权限？ | 扩展的唯一功能就是在这些页面上替换界面（见 `listing.md` 的权限表）。 |
| 有没有远程代码？ | 没有，全部代码随包分发（选 “No”）。 |
| 有没有收集数据？ | 没有。设置与「最近浏览」只写本机 `chrome.storage.local`；详见 `PRIVACY.md`。 |
| 审核员打不开页面怎么办？ | 打开随包的演示页 `chrome-extension://<ID>/demo/index.html`。 |
| 与 NGA 官方的关系？ | 第三方非官方工具，商品页文案里已声明。 |
