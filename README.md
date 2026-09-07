# flyinfuture123-prog.github.io

個人靜態網站。目前有五個頁面，都放在不容易被猜到的隨機路徑底下，並加上
`noindex` 避免被搜尋引擎收錄。

| 頁面 | 路徑 | 資料來源 |
| --- | --- | --- |
| 台股戰情室 | `tw-f7ae6d8241f3f8e1/` | 產出當下寫死在頁面內 |
| 台股權值股新聞分析 | `news-0a1318b62d883e0a/` | 每天早上自動更新 |
| 全球服飾價格與時尚趨勢 | `fashion-8fc308ee73649044/` | 每天早上自動更新 |
| AI驅動專利論文地圖 | `patentmap-4b9c7e2a51d8f306/` | 一次性整理，資料寫在 `data/book.json` |
| 全球螢光粉進展 | `phosphor-f44f6e8f9e7fdd61/` | 一次性整理，資料寫在 `data/site.json` |

---

## 台股權值股新聞分析

每天台灣時間早上 **07:23**（開盤前）自動執行一次：抓取台股前 20 大權值股的
新聞、**逐則**做情緒與重要性分析，產生當日簡報頁面，並把資料 commit 回這個
repository，GitHub Pages 隨即更新。

網址：`https://flyinfuture123-prog.github.io/news-0a1318b62d883e0a/`

### 每則新聞會被標註什麼

| 欄位 | 內容 |
| --- | --- |
| 情緒 | −100 ～ +100，並分成 強力利空／偏空／中性／偏多／強力利多 |
| 信心 | 0 ～ 100%。標題帶「傳」「可望」「恐」等推測語氣會明顯下修 |
| 題材 | 財報營收、財測展望、法人籌碼、訂單客戶、產能擴廠…共 18 類 |
| 影響時間 | 短期／中期／長期 |
| 重要性 | 1 ～ 5，綜合媒體層級、幾家跟進、是否有具體數字、事件類型 |
| 逐則分析 | 一段中文說明：判斷依據是什麼、影響誰、有什麼保留 |
| 風險標記 | 推測性報導、單一非主流來源、多空訊號混雜、含語意反轉… |

頁面上另外有：依權重加權的大盤新聞情緒、20 檔的新聞溫度條、當日最值得看的
幾則、每檔個股的綜合評述，以及可依個股／題材／方向／關鍵字篩選的完整清單。

### 資料從哪裡來

- **主要來源：Google 新聞 RSS 搜尋（台灣、繁中）**。對 20 檔權值股加上大盤
  各跑一組查詢，涵蓋經濟日報、工商時報、中央社、鉅亨網、MoneyDJ 等台灣財經
  媒體。免金鑰、不需註冊。
- **次要來源（best-effort）**：鉅亨網公開列表、Yahoo 股市 RSS。這兩個掛掉只
  會少幾則大盤新聞，不會讓整個排程失敗。
- **行情（best-effort）**：證交所 OpenAPI 的每日收盤。

同一則通訊社稿常被十幾家媒體原文照登，程式會用「中文字元 3-gram 的包含度」
做近似去重，並把「有幾家媒體同時報導」保留下來當成重要性訊號。

### 分析引擎：兩層

1. **規則式（預設，永遠可用）**
   自建的繁體中文財經詞庫：170+ 利多詞、190+ 利空詞、46 組片語覆寫、語氣強化
   詞、反轉詞、推測詞。片語覆寫是關鍵 —— 「利空出盡」是利多、「利多出盡」是
   利空、「由虧轉盈」是明確利多、「除息」本身中性，這些照字面拆開一定會判反。
   完全離線、零成本、每天都跑得出來。

2. **Claude 深度分析（選用）**
   在 repository 設定 `ANTHROPIC_API_KEY` secret 之後，每則新聞會再送給 Claude
   重寫一次分析，讀出規則比對不到的脈絡。**沒有設定金鑰、API 出錯、回傳解析
   失敗 —— 任何一種情況都會自動退回規則式結果，不會讓排程失敗。**

   成本參考：以每天約 200 則、預設 `claude-opus-5` 估算，大約每天 US$1～2。
   要省的話可以設定 repository variable：

   | Variable | 說明 | 預設 |
   | --- | --- | --- |
   | `TWNEWS_LLM_MODEL` | 改用較便宜的模型，例如 `claude-sonnet-5`、`claude-haiku-4-5` | `claude-opus-5` |
   | `TWNEWS_LLM_MAX_ARTICLES` | 只深度分析重要性最高的前 N 則 | `200` |
   | `TWNEWS_LLM_BATCH` | 一次送幾則給模型 | `10` |

### 檔案結構

```
scripts/
  stocks.py       20 檔權值股名單：代號、別名、產業、權重、搜尋詞
  net.py          共用 HTTP 層（逾時、重試、退避；永遠不往上丟例外）
  textutil.py     中文標題正規化與近似去重
  fetch_news.py   各來源的抓取與關聯個股判定
  lexicon.py      財經詞庫與主題分類
  analyze.py      規則式分析引擎（逐則 + 個股彙總 + 大盤簡報）
  llm.py          選用的 Claude 深度分析層
  build.py        統籌：抓取 → 分析 → 寫出資料檔
tests/
  make_fixture.py 產生離線測試資料
  test_pipeline.py 語意回歸測試 + 資料結構驗證
news-0a1318b62d883e0a/
  index.html      網頁（讀取 data/latest.json）
  data/
    latest.json   今日資料
    YYYY-MM-DD.json 每日封存（保留 180 天）
    index.json    可查詢的日期索引
.github/workflows/
  daily-news.yml     每日 07:23（台灣時間）排程更新並回推
  check.yml          push/PR 時用離線 fixture 跑完整條流程
```

### 本機執行

```bash
python -m pip install -r requirements.txt

# 用離線 fixture 跑（不連外，適合改程式時驗證）
python tests/make_fixture.py
python scripts/build.py --site-dir news-0a1318b62d883e0a \
  --fixture tests/fixtures/news_sample.json --no-llm
python tests/test_pipeline.py news-0a1318b62d883e0a/data/latest.json

# 真的去抓新聞
python scripts/build.py --site-dir news-0a1318b62d883e0a --days 2

# 本機預覽（直接開檔會被瀏覽器的 CORS 擋住 fetch）
python -m http.server 8000 --directory news-0a1318b62d883e0a
```

### 要調整什麼

- **換股／改權重**：編輯 `scripts/stocks.py` 的 `TOP20`。權重會隨行情漂移，這份
  名單是人工策展的快照 —— 自動換股會讓歷史封存難以比對，所以刻意不做。
- **加減詞彙**：編輯 `scripts/lexicon.py`。加完記得跑 `python scripts/lexicon.py`
  做自我檢查（同一個詞不能同時是利多和利空）。
- **改執行時間**：`.github/workflows/daily-news.yml` 的 cron。GitHub 用 UTC，
  台北是 UTC+8，所以早上 07:23 要寫成 `23 23 * * *`。分鐘數刻意不用 0 或 30 ——
  GitHub 的排程佇列在整點、半點負載最重，挑冷門分鐘可以少被延遲。就算延後半
  小時，也還在 09:00 開盤前產好。

### 已知限制

- 情緒與重要性是程式依**標題與摘要**推估的，沒有讀原文全文，一定會有誤判。
  頁面上的風險標記就是為了讓這件事看得見。
- Google 新聞 RSS 的連結是轉址網址，點進去會先經過 Google 再跳到原始媒體。
- 排程 workflow 在 repository 連續 60 天沒有任何活動後會被 GitHub 自動停用；
  這個排程本身每天都會 commit，所以正常運作下不會被停掉。
- 內容僅供資訊整理與研究參考，**不構成任何投資建議**。

---

## 全球服飾價格與時尚趨勢

與台股站同一套架構的姊妹站：每天台灣時間早上 **07:52** 自動執行一次，
抓取全球服飾產業新聞（中英雙語）、**逐則**分析價格方向與趨勢標籤，
產生當日頁面並 commit 回 repository。

網址：`https://flyinfuture123-prog.github.io/fashion-8fc308ee73649044/`

### 這個站在看什麼

- **價格方向**：每則新聞標 −100（明確降價／促銷）～ +100（明確漲價）。
  詞庫懂「凍漲」「吸收關稅」是不漲價、「取消折扣」是實質漲價、
  「price hike」「slashing prices」等英文訊號也吃得下來。
- **品牌溫度**：32 個觀察對象，分快時尚／運動休閒／精品／電商平台／其他
  五個板塊（UNIQLO、ZARA、SHEIN、NIKE、愛馬仕、香奈兒、儒鴻聚陽…），
  名稱與別名用台灣媒體實際寫法（鉅亨「耐吉」、經濟日報「迅銷」）。
- **趨勢雷達**：26 個趨勢標籤（波希米亞復興、靜奢老錢風、足球球衣風、
  芭蕾風、古著二手…），各標 2026 年當下的上升／持平／退燒狀態，
  這是人工策展的快照，隨季度手動更新 `scripts/fashion_lexicon.py`。
- **衣價為什麼變動**：關稅、小額免稅、棉價、運價、產地工資等十個
  驅動因素的背景說明卡（人工整理，標註整理時點）。
- **服飾物價指數**（best-effort）：FRED 的美國服飾 CPI 與 Eurostat 的
  歐元區衣著鞋類 HICP，免金鑰端點，抓不到就不顯示。

### 資料從哪裡來

- **主要來源：Google 新聞 RSS 搜尋**，中文（台灣）與英文（美國）各一組：
  主題查詢（服飾漲價、快時尚、穿搭趨勢、時裝週、精品調價、紡織成本、
  二手古著…）加上逐品牌查詢。事件型主題（精品調價、關稅）用 30 天窗口，
  日常題材用短窗口。
- **次要來源（best-effort）**：WWD、FashionUnited、Hypebeast 等國際時尚
  媒體的公開 RSS，掛掉只會少幾則國際新聞。

### 檔案結構（時尚站）

```
scripts/
  fashion_brands.py   32 個品牌／板塊：別名、板塊、搜尋詞、觀察重點
  fashion_lexicon.py  中英雙語價格詞庫、主題分類、地區、趨勢標籤、驅動因素
  fashion_fetch.py    抓取與品牌關聯（共用 net.py / textutil.py）
  fashion_analyze.py  規則式分析（價格方向 + 趨勢標籤 + 品牌/趨勢彙總）
  fashion_llm.py      選用的 Claude 深度分析層（FASHION_LLM_* 變數）
  fashion_build.py    統籌：抓取 → 分析 → 寫出資料檔
tests/
  make_fashion_fixture.py   產生離線測試資料
  test_fashion_pipeline.py  語意回歸測試 + 資料結構驗證
fashion-8fc308ee73649044/
  index.html          網頁（讀取 data/latest.json）
  data/               今日資料 + 每日封存（保留 180 天）
.github/workflows/
  daily-fashion.yml   每日 07:52（台灣時間）排程更新並回推
```

### 本機執行（時尚站）

```bash
python tests/make_fashion_fixture.py
python scripts/fashion_build.py --site-dir fashion-8fc308ee73649044 \
  --fixture tests/fixtures/fashion_sample.json --no-llm
python tests/test_fashion_pipeline.py fashion-8fc308ee73649044/data/latest.json

# 真的去抓新聞
python scripts/fashion_build.py --site-dir fashion-8fc308ee73649044 --days 2

# 本機預覽
python -m http.server 8000 --directory fashion-8fc308ee73649044
```

Claude 深度分析同樣是選配：設定 `ANTHROPIC_API_KEY` secret 即啟用，
可用 repository variables `FASHION_LLM_MODEL`、`FASHION_LLM_MAX_ARTICLES`、
`FASHION_LLM_BATCH` 調整。沒設定時規則式引擎照樣每天產出。

### 已知限制（時尚站）

- 價格方向與重要性依**標題與摘要**推估，趨勢狀態（上升／退燒）是人工
  快照，都會過時或誤判；「衣價為什麼變動」是背景整理，不是即時數據。
- 英文新聞的標題照原文顯示，逐則分析一律以中文撰寫。
- 內容僅供資訊整理與研究參考，**不構成任何消費或投資建議**。


---

## AI驅動專利論文地圖

把《AI驅動專利論文地圖協助掌握創新研發致勝趨勢》（劉如熹、黃郁倢、張芸屏
編著，臺大化學系材料化學實驗室，2025 年 8 月完成，全書 96 頁）的研發流程
整理成一頁式網站。

網址：`https://flyinfuture123-prog.github.io/patentmap-4b9c7e2a51d8f306/`

### 頁面有什麼

| 區塊 | 內容 |
| --- | --- |
| 端到端研發流程 | 把散落在第三、四、六、七章的方法接成 11 站的一條動線，每站標註書中出處頁碼 |
| AI 五步驟 | 第 7-3 節的核心流程圖（圖四十二）：Elicit → SciSpace → Derwent Innovation → 生成模型 → Gamma |
| 六個應用時機 | 6-2 節：收集創意、研發規劃、研究開發、申請專利、成果應用、技術合作 |
| AI 工具 | 7-2 節九項工具的功能、特點與書中實測範例 |
| 全書導讀 | 依原書章節整理，可展開閱讀。含三大資料庫檢索與四種製圖的逐步操作 |
| 來源說明 | 說明哪幾頁用影像判讀、哪幾頁用 OCR、哪幾頁不收錄 |

### 資料怎麼來的

原始檔為 CamScanner 掃描的 PDF（53.7 MB），存放於 Google Drive。因為
連接器的下載上限約 6 MB、OCR 讀取上限約 10 MB，檔案被切成多份分批取得，
再依印在頁面上的頁碼還原順序：

- 第 1–26、37–45、78–81 頁 — 用 PyMuPDF 轉成頁面圖片後逐頁判讀。第三章與
  4-4／4-5 全是操作步驟截圖，圖片判讀比 OCR 可靠得多
- 第 27–36、46–77 頁 — 由 Google Drive 的 OCR 取得文字，圖片僅存圖說

收錄範圍為第 1–81 頁。第 82–96 頁（7-3 的個別簡報展示範例、第八章結論、
作者簡歷）依需求不收錄。

### 已知限制

- OCR 段落的化學式與表格數值可能有辨識誤差。已知原書表一、表二的化學式
  在 OCR 後多處失真（如 `Y₃Al₅O₁₂` 被讀成 `YAlsOrz`），頁面上只保留欄位
  結構與摘要說明，未逐格照抄。
- 原書第 18 頁後半、第 39–40 頁與第 44–45 頁的步驟編號有重複（重新由
  「第二步」起算、兩個「第十步」），頁面上改為連續編號並加註說明。
- 本頁為個人閱讀整理，非原書之電子版；著作權屬原作者。

### 重新產生資料檔

內容以 Python 模組維護，`data/book.json` 由產生器輸出：

```bash
python3 scripts/patentmap_build.py patentmap-4b9c7e2a51d8f306/data/book.json

# 本機預覽（必須走 HTTP，file:// 會被瀏覽器擋下 fetch）
python -m http.server 8000 --directory patentmap-4b9c7e2a51d8f306
```

改了 `scripts/patentmap/` 的模組就要重跑產生器，否則頁面會跟原始資料對不上
而且不會有任何錯誤訊息。`.github/workflows/check.yml` 有一步會重跑產生器並和
`data/book.json` 做 diff，兩邊不同步時 CI 會直接紅燈。

---

## 全球螢光粉進展

把全世界螢光粉（phosphor）的科學、材料、產業與最新動態整理成淺顯易懂的
一頁式資訊站，給台灣讀者看，用台灣用語。

網址：`https://flyinfuture123-prog.github.io/phosphor-f44f6e8f9e7fdd61/`

### 頁面有什麼

| 區塊 | 內容 |
| --- | --- |
| 一分鐘看懂 | 螢光粉是什麼、白光 LED 怎麼發光（示意圖）、關鍵數字、七個規格指標怎麼讀 |
| 光譜圖 | 互動光譜：依峰值波長與半高寬畫出的示意曲線，七種情境（暖白、背光、全光譜、近紅外…）可切換、可逐條開關、可讀數據表 |
| 里程碑 | 1852 年到 2026 年的發展時間線，可依地區與類別篩選 |
| 材料家族 | 24 種螢光粉家族卡片（YAG、氮化物、KSF、SLA／SALON、近紅外、夜光、閃爍體、量子點…）與比較表 |
| 應用 | 照明、顯示、雷射、車用、健康照明、近紅外感測、園藝、夜光防偽、醫療影像 |
| 全球版圖 | 日本、美國、歐洲、中國、韓國、台灣六區的企業與研究團隊；市場規模各家估計並列；專利地圖 |
| 最新動態 | 2024–2026 年的產品、論文、專利授權、法規、市場事件，每則附「為什麼重要」 |
| 研究前沿 | 窄頻紅粉、KSF 抗濕、雷射陶瓷、Micro LED 色轉換、AI 材料發現等九個方向 |
| 常見問題 | 毒性、稀土、光衰、怎麼選燈、螢光粉對量子點、藍光… |
| 名詞解釋 | 60 多條術語，可搜尋 |
| 來源說明 | 整理方法、已知限制、引用來源清單（由產生器自動彙整） |

### 資料怎麼來的

2026 年 9 月以網路檢索一次性整理：分十個主題各自蒐集附來源的事實，再由獨立
的查核步驟試圖推翻或修正其中的數字、年份、人名與公司名。每則資料都附上
當時可查到的公開來源連結；市場數字各家不一致時並列範圍而不下結論。

### 重新產生資料檔

內容以 Python 模組維護（每個區塊一個檔案），`data/site.json` 由產生器輸出：

```
scripts/phosphor/
  meta.py          站台標題、整理時點
  intro.py         一分鐘看懂、關鍵指標
  spectra.py       光譜圖用的曲線（峰值、半高寬）與情境
  timeline.py      里程碑
  materials.py     材料家族卡片與比較表
  applications.py  應用領域
  landscape.py     全球版圖、市場估計、專利
  news.py          最新動態
  frontier.py      研究前沿
  faq.py           常見問題
  glossary.py      名詞解釋
  sources.py       整理方法、限制、代表性來源
scripts/phosphor_build.py   組裝、檢查、輸出 data/site.json
```

```bash
python3 scripts/phosphor_build.py phosphor-f44f6e8f9e7fdd61/data/site.json

# 本機預覽（必須走 HTTP，file:// 會被瀏覽器擋下 fetch）
python -m http.server 8000 --directory phosphor-f44f6e8f9e7fdd61
```

產生器會檢查欄位完整性、網址格式、日期格式、id 重複，並抓幾個常混進來的
簡體／大陸用語（荧光、激光、硅、纳米…），有問題就不寫檔。`.github/workflows/check.yml`
會重跑產生器並和 `data/site.json` 比對，兩邊不同步 CI 就紅燈。

### 已知限制

- 光譜圖是示意高斯曲線，不是實測光譜；KSF 等線狀發光以主峰示意。
- 市場規模各研究機構相差數倍，頁面上只呈現範圍與來源。
- 廠商或專利持有方自述的數字已標明立場，未經第三方驗證。
- 一次性快照，不會自動更新；「最新動態」以 2024 年到 2026 年 9 月為主。
- 內容僅供學習與研究參考，不構成任何採購、投資或技術選型建議。
