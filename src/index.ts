import { crawl } from "./crawler";

async function main(){
    await crawl('https://cmlabs.co', 'cmlabs.html');
  await crawl('https://sequence.day', 'sequence.html');
}

main();