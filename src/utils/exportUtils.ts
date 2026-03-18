import RNFS from 'react-native-fs';
import { generatePDF } from 'react-native-html-to-pdf';
import { Share } from 'react-native';
import { Session } from './sessions';

export type ExportFormat = 'pdf' | 'markdown' | 'txt';

const EXPORT_DIR = `${RNFS.DocumentDirectoryPath}/exports`;

const ensureExportDir = async () => {
  if (!(await RNFS.exists(EXPORT_DIR))) await RNFS.mkdir(EXPORT_DIR);
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);

const buildHtml = (session: Partial<Session>, title: string): string => {
  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const summaryHtml = (session.summary ?? '')
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('');

  const transcriptHtml = (session.transcription ?? '')
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, Helvetica, sans-serif; color: #1a1a2e;
           max-width: 700px; margin: 40px auto; padding: 0 24px; }
    h1   { font-size: 22px; color: #3a3a6e; margin-bottom: 4px; }
    .meta { color: #888; font-size: 12px; margin-bottom: 32px; }
    h2   { font-size: 16px; color: #5a5aae; border-bottom: 1px solid #ddd;
           padding-bottom: 6px; margin-top: 28px; }
    p    { font-size: 14px; line-height: 1.8; margin: 4px 0; color: #333; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Generated ${date} - ${session.whisperModel ?? ''} - ${session.qwenModel ?? ''}</p>
  <h2>Summary</h2>
  ${summaryHtml}
  <h2>Full Transcript</h2>
  ${transcriptHtml}
</body>
</html>`;
};

const buildMarkdown = (session: Partial<Session>, title: string): string => {
  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : new Date().toLocaleString();

  return [
    `# ${title}`,
    '',
    `> **Date:** ${date}`,
    `> **Models:** ${session.whisperModel ?? ''} - ${session.qwenModel ?? ''}`,
    `> **Format:** ${session.summaryFormat ?? ''}`,
    '',
    '## Summary',
    '',
    session.summary ?? '',
    '',
    '## Full Transcript',
    '',
    session.transcription ?? '',
    '',
  ].join('\n');
};

const buildTxt = (session: Partial<Session>, title: string): string => {
  const date = session.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : new Date().toLocaleString();

  return [
    title,
    '='.repeat(title.length),
    `Date   : ${date}`,
    `Models : ${session.whisperModel ?? ''} - ${session.qwenModel ?? ''}`,
    '',
    'SUMMARY',
    '-------',
    session.summary ?? '',
    '',
    'TRANSCRIPT',
    '----------',
    session.transcription ?? '',
    '',
  ].join('\n');
};

export const exportSession = async (
  session: Partial<Session>,
  format: ExportFormat,
  title = 'VoiceScribe Recording',
): Promise<void> => {
  await ensureExportDir();

  const base = sanitizeFilename(title || `recording_${Date.now()}`);
  let filePath: string;

  switch (format) {
    case 'pdf': {
      const html = buildHtml(session, title);
      const result = await generatePDF({
        html,
        fileName: base,
        directory: EXPORT_DIR,
        base64: false,
      });
      if (!result.filePath) throw new Error('PDF generation failed');
      filePath = result.filePath;
      break;
    }
    case 'markdown': {
      filePath = `${EXPORT_DIR}/${base}.md`;
      await RNFS.writeFile(filePath, buildMarkdown(session, title), 'utf8');
      break;
    }
    case 'txt':
    default: {
      filePath = `${EXPORT_DIR}/${base}.txt`;
      await RNFS.writeFile(filePath, buildTxt(session, title), 'utf8');
      break;
    }
  }

  await Share.share({
    title,
    url: `file://${filePath}`,
    message: format !== 'pdf' ? buildTxt(session, title) : title,
  });
};
