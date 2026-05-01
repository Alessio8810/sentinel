require("dotenv").config();
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function test() {
    const username = process.argv[2] || "tiktok";
    console.log("Avvio browser per @" + username + "...");

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const cookies = [];
    if (process.env.TIKTOK_SESSIONID) cookies.push({ name: "sessionid", value: process.env.TIKTOK_SESSIONID, domain: ".tiktok.com", path: "/" });
    if (process.env.TIKTOK_TTWID) cookies.push({ name: "ttwid", value: process.env.TIKTOK_TTWID, domain: ".tiktok.com", path: "/" });
    if (cookies.length) await page.setCookie(...cookies);

    // Intercetta le risposte di rete che contengono i video
    var videoData = null;
    page.on("response", async function(response) {
        var url = response.url();
        if (url.includes("/api/post/item_list") || url.includes("user/post") || url.includes("aweme/v1/web/aweme/post")) {
            console.log("XHR trovato:", url.slice(0, 100));
            try {
                var json = await response.json();
                if (json && (json.itemList || json.aweme_list)) {
                    videoData = json.itemList || json.aweme_list;
                    console.log("Video trovati nella risposta XHR:", videoData.length);
                }
            } catch(e) {}
        }
    });

    await page.goto("https://www.tiktok.com/@" + username, { waitUntil: "networkidle0", timeout: 45000 });
    
    // Aspetta un po' per permettere le XHR di completarsi
    await new Promise(function(r) { setTimeout(r, 5000); });

    if (videoData && videoData.length) {
        var v = videoData[0];
        console.log("\nUltimo video da XHR:");
        console.log("  ID:", v.id || v.aweme_id);
        console.log("  Desc:", (v.desc || "").slice(0, 80));
    } else {
        console.log("\nNessun video trovato via XHR. Provo da DOM...");
        
        // Fallback: cerca anche i link video direttamente nel DOM
        var links = await page.$$eval("a[href*='/video/']", function(els) {
            return els.map(function(el) { return el.href; }).filter(function(h) { return h.includes("/video/"); }).slice(0, 5);
        }).catch(function() { return []; });
        console.log("Link video nel DOM:", links);
    }

    await browser.close();
}

test().catch(function(e) { console.error("ERRORE:", e.message); process.exit(1); });
