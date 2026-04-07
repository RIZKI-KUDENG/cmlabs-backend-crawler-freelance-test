import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";


export async function crawl(url: string, filename: string){
    const browser = await puppeteer.launch({
        headless: true,
    });
    const page = await browser.newPage();

    try{
        console.log(`Crawling ${url}...`);
        await page.goto(url, { waitUntil: "networkidle2"});
        const html = await page.content();
        const filePath = path.join(__dirname,'../result', filename);
        fs.writeFileSync(filePath, html, "utf-8");
        console.log(`Saved HTML to ${filePath}`);
    }catch(error){
        console.error(`Error crawling ${url}:`, error);
    }finally{
        await browser.close();
    }
}