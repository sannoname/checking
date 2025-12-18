/**
 * Chiikawa Market 自動化核心邏輯
 */

// 1. 提取商品 Handle
const getHandles = (input) => {
    return input.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => l.includes('/products/') ? l.split('/products/')[1].split(/[?#]/)[0] : l);
};

// 2. 向 Shopify API 請求 Variant ID
async function getProductDetail(handle) {
    try {
        const response = await fetch(`https://chiikawamarket.jp/products/${handle}.js`);
        if (!response.ok) throw new Error('Network Error');
        const data = await response.json();

        // 偵測是否為預約商品 (依據標籤與標題)
        const isPre = data.tags.some(t => t.includes("予約") || t.includes("preorder")) ||
            data.title.includes("予約");

        // 取得首位可銷售變體 ID
        const activeVariant = data.variants.find(v => v.available) || data.variants[0];

        return {
            id: activeVariant.id,
            title: data.title,
            isPre: isPre,
            available: activeVariant.available
        };
    } catch (e) {
        return { error: true, handle: handle };
    }
}

// 3. UI 控制與主程序
document.getElementById('startConvert').addEventListener('click', async () => {
    const rawInput = document.getElementById('urlInput').value;
    const handles = getHandles(rawInput);
    if (handles.length === 0) return;

    const status = document.getElementById('statusInfo');
    const results = document.getElementById('results');

    status.classList.remove('hidden');
    results.classList.add('opacity-30');

    // 併發執行 API 請求
    const rawResults = await Promise.all(handles.map(h => getProductDetail(h)));

    const regularIds = [];
    const preorderIds = [];
    const errors = [];

    rawResults.forEach(item => {
        if (item.error) errors.push(`解析失敗: ${item.handle}`);
        else if (!item.available) errors.push(`缺貨中: ${item.title}`);
        else if (item.isPre) preorderIds.push(item.id);
        else regularIds.push(item.id);
    });

    // 4. 更新 UI 顯示與連結合成
    const buildUrl = (ids) => `https://chiikawamarket.jp/cart/${ids.map(id => `${id}:1`).join(',')}?storefront=true`;

    renderResult('regSection', 'regRaw', 'regBtn', regularIds, buildUrl);
    renderResult('preSection', 'preRaw', 'preBtn', preorderIds, buildUrl);

    // 處理錯誤清單
    const errSec = document.getElementById('errorSection');
    const errList = document.getElementById('errorList');
    if (errors.length > 0) {
        errSec.classList.remove('hidden');
        errList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    } else {
        errSec.classList.add('hidden');
    }

    status.classList.add('hidden');
    results.classList.remove('opacity-30');
});

function renderResult(sectionId, rawId, btnId, ids, urlBuilder) {
    const section = document.getElementById(sectionId);
    const rawDiv = document.getElementById(rawId);
    const btn = document.getElementById(btnId);

    if (ids.length > 0) {
        section.classList.remove('hidden');
        const finalUrl = urlBuilder(ids);
        rawDiv.innerText = finalUrl;
        btn.href = finalUrl;
    } else {
        section.classList.add('hidden');
    }
}

// 全域複製函式
window.copyRawUrl = function (id) {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ 結帳連結已複製！");
    });
};