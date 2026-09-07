# -*- coding: utf-8 -*-
"""光譜互動圖用的資料。曲線以「峰值波長＋半高寬」畫成示意高斯曲線，
數值取自文獻／廠商規格的典型值，不是特定產品的實測光譜。"""

SPECTRA = {
    "lead": "光譜是理解螢光粉最直接的方式：橫軸是波長（顏色），縱軸是強度。點選情境，看看「暖白燈泡」「電視背光」「全光譜健康照明」「近紅外感測」各自是由哪些發光成分疊起來的；也可以自己開關曲線。把滑鼠移到圖上可讀取各成分在該波長的相對強度。",
    "curves": [
        {"id": "blue450", "name": "藍光 LED 晶片", "short": "藍光晶片", "formula": "InGaN", "peak": 450, "fwhm": 20, "color": "藍", "rel": 0.9, "note": "白光 LED 的激發光源；沒被螢光粉吸收的部分直接成為白光中的藍色成分。"},
        {"id": "violet405", "name": "紫光 LED 晶片", "short": "紫光晶片", "formula": "InGaN", "peak": 405, "fwhm": 18, "color": "紫", "rel": 0.6, "note": "「全光譜」「類太陽光」LED 常用紫光晶片激發紅綠藍三種螢光粉，藍光成分改由螢光粉提供，較不刺眼。"},
        {"id": "yag", "name": "YAG:Ce 黃色螢光粉", "short": "YAG:Ce", "formula": "Y3Al5O12:Ce3+", "peak": 555, "fwhm": 115, "color": "黃", "note": "1996 年至今的主流黃粉，譜帶很寬，藍光＋黃光即可成白光，但缺紅色成分，顯色指數約 70–80。"},
        {"id": "luag", "name": "LuAG:Ce 綠色螢光粉", "short": "LuAG:Ce", "formula": "Lu3Al5O12:Ce3+", "peak": 520, "fwhm": 110, "color": "綠", "note": "把 YAG 的釔換成鎦，發光藍移成綠色，熱穩定性好，常用於高顯色與雷射照明。"},
        {"id": "bsialon", "name": "β-SiAlON:Eu 綠色螢光粉", "short": "β-SiAlON", "formula": "Si6-zAlzOzN8-z:Eu2+", "peak": 538, "fwhm": 55, "color": "綠", "note": "窄頻綠粉（峰值 535–540 nm），NIMS 發明、Denka 量產，是廣色域背光的標準綠色。"},
        {"id": "casn", "name": "CASN:Eu 紅色螢光粉", "short": "CASN", "formula": "CaAlSiN3:Eu2+", "peak": 650, "fwhm": 90, "color": "紅", "note": "氮化物紅粉，2000 年代中期由 NIMS／三菱化學推出，高顯色暖白 LED 的紅色來源；譜帶偏寬、尾巴伸進人眼不敏感的深紅區，會損失一些效率。"},
        {"id": "scasn", "name": "SCASN:Eu 橙紅色螢光粉", "short": "SCASN", "formula": "(Sr,Ca)AlSiN3:Eu2+", "peak": 625, "fwhm": 85, "color": "橙紅", "note": "在 CASN 中加入鍶讓峰值藍移，效率較高，是目前用量最大的紅粉之一。"},
        {"id": "ksf", "name": "KSF:Mn⁴⁺ 紅色螢光粉", "short": "KSF", "formula": "K2SiF6:Mn4+", "peak": 631, "fwhm": 6, "color": "紅", "note": "錳(IV)氟化物線狀發光，實際上是 600–650 nm 之間的多條細線（此處以主峰示意），色純度極高，是廣色域背光與高顯色照明的主力紅色。"},
        {"id": "sla", "name": "SLA:Eu 窄頻紅色螢光粉", "short": "SLA", "formula": "Sr[LiAl3N4]:Eu2+", "peak": 650, "fwhm": 50, "color": "紅", "note": "2014 年 LMU Schnick 團隊與 Lumileds 發表，半高寬約 50 nm，熱穩定性極佳。"},
        {"id": "salon", "name": "SALON:Eu 窄頻紅色螢光粉", "short": "SALON", "formula": "Sr[Li2Al2O2N2]:Eu2+", "peak": 614, "fwhm": 48, "color": "紅", "note": "2019 年發表，峰值 614 nm 落在人眼較敏感的位置，同樣窄頻，被視為下一代高效紅粉。"},
        {"id": "farred", "name": "遠紅光螢光粉（植物用）", "short": "遠紅光", "formula": "例如 (Ba,Sr)Al12O19:Cr3+ / Mn4+ 類", "peak": 730, "fwhm": 80, "color": "遠紅", "note": "植物的光敏素對 730 nm 附近的遠紅光有反應，園藝燈用它調節開花與株型。"},
        {"id": "nircr", "name": "Cr³⁺ 寬頻近紅外螢光粉", "short": "NIR Cr³⁺", "formula": "例如 ScBO3:Cr3+ / 石榴石:Cr3+", "peak": 800, "fwhm": 120, "color": "近紅外（不可見）", "note": "藍光激發後放出 700–1000 nm 的寬頻近紅外光，用於食品、農產品的光譜分析與生醫感測。"},
        {"id": "glow", "name": "夜光粉 SrAl₂O₄:Eu,Dy", "short": "夜光粉", "formula": "SrAl2O4:Eu2+,Dy3+", "peak": 520, "fwhm": 90, "color": "黃綠", "note": "根本特殊化學（Nemoto）1993 年發明、1996 年發表的長餘輝材料，關燈後可持續發光數小時，用於逃生標示與手錶。"},
    ],
    "presets": [
        {"name": "傳統白光 LED（藍光＋YAG）", "curves": ["blue450", "yag"],
         "note": "最經典、最便宜的配方。藍光穿過黃色螢光粉，兩者混成冷白到中性白。光譜在紅色區域幾乎是空的，所以顯色指數只有 70 出頭，紅色物體看起來偏暗；也不容易做出 2700 K 的暖白。"},
        {"name": "高顯色暖白（藍光＋綠粉＋紅粉）", "curves": ["blue450", "luag", "scasn"],
         "note": "把黃粉換成綠粉並加入氮化物紅粉，光譜在紅色區域被補滿，Ra 可達 90 以上、R9 大幅改善，是博物館、零售、住宅暖白燈的主流配方。代價是紅粉的寬譜帶有一部分落在人眼不敏感的深紅區，發光效率會掉一些。"},
        {"name": "廣色域電視背光（藍光＋β-SiAlON＋KSF）", "curves": ["blue450", "bsialon", "ksf"],
         "note": "顯示器要的是三個「分得很開又很純」的顏色。窄頻綠粉 β-SiAlON 加上線狀紅粉 KSF，讓 LCD 背光的色域從約 72% NTSC 拉到覆蓋 DCI-P3 九成以上，是 2015 年以來廣色域電視背光最普及的方案，也是量子點背光的主要對手。"},
        {"name": "下一代窄頻紅（SLA／SALON）", "curves": ["blue450", "bsialon", "sla", "salon"],
         "note": "SLA（650 nm）與 SALON（614 nm）把紅光集中在約 50 nm 的窄帶內，避免能量浪費在深紅區；論文中的原型 LED 比市售高顯色 LED 效率分別提升 14% 與 16%。這條路線的挑戰在於合成困難與水氣穩定性。"},
        {"name": "全光譜／類太陽光（紫光晶片＋三色粉）", "curves": ["violet405", "bsialon", "luag", "scasn"],
         "note": "用 405 nm 左右的紫光晶片激發藍、綠、紅螢光粉，讓光譜平滑、沒有尖銳的藍光峰，接近日光。首爾半導體 SunLike、日亞 Optisolis／Vitasolis 等產品走的是類似路線；圖中以綠與紅粉示意，實際還會加入藍色螢光粉。"},
        {"name": "近紅外感測 LED（藍光＋Cr³⁺ 螢光粉）", "curves": ["blue450", "nircr"],
         "note": "藍光晶片激發鉻(III)螢光粉，放出 700–1000 nm 的寬頻近紅外光，等於把一顆迷你光譜儀光源塞進 LED 裡。可用來量水果糖度、食品含水量、皮膚血氧等，是 2016 年之後成長最快的螢光粉研究題目之一。"},
        {"name": "植物照明（藍光＋遠紅光粉）", "curves": ["blue450", "scasn", "farred"],
         "note": "植物主要吸收藍光與紅光，遠紅光（730 nm）則影響開花與莖的伸長。園藝 LED 會在白光或紅藍光之外，用遠紅光螢光粉或遠紅光晶片補足這段光譜。"},
    ],
}
