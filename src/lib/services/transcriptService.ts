import * as cheerio from 'cheerio';

const TRANSCRIPT_BASE_URL = 'https://youtubetotranscript.com/transcript';

export async function fetchAndParseTranscript(videoId: string): Promise<string> {
  const transcriptUrl = `${TRANSCRIPT_BASE_URL}?v=${videoId}`;

  const response = await fetch(transcriptUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`External service failed for video ${videoId} with status: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const paragraphs: string[] = [];
  $('#transcript > p').each((i, p_element) => {
    let currentParagraph = '';
    $(p_element).contents().each((j, content_element) => {
      if (content_element.type === 'tag' && content_element.name === 'span') {
        const text = $(content_element).text().replace(/\s+/g, ' ').trim();
        if (text) currentParagraph += text + ' ';
      } else if (content_element.type === 'tag' && content_element.name === 'br') {
        if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    });
    if (currentParagraph.trim()) paragraphs.push(currentParagraph.trim());
  });

  const fullTranscript = paragraphs.join('\n\n');

  return fullTranscript;
}