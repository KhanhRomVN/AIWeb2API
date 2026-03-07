import React, { useState } from 'react';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';
import { Copy, Download, Check } from 'lucide-react';

interface MessageContentProps {
  content: string;
  workspacePath?: string;
  onFileClick?: (path: string) => void;
}

// Language to extension mapping
const EXTENSIONS: Record<string, string> = {
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  swift: 'swift',
  kotlin: 'kt',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yml',
  xml: 'xml',
  markdown: 'md',
  bash: 'sh',
  shell: 'sh',
  plaintext: 'txt',
};

const LANGUAGE_MAP: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  sh: 'shell',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
};

/**
 * Parses markdown content and renders code blocks with syntax highlighting
 */
export const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (code: string, language: string) => {
    const ext = EXTENSIONS[language.toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Basic regex for code blocks and bold text
    const combinedRegex = /```(\w+)?\n([\s\S]*?)```|(\*\*(.*?)\*\*)/g;

    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${key++}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>,
        );
      }

      const fullMatch = match[0];

      if (fullMatch.startsWith('```')) {
        const rawLanguage = match[1]?.toLowerCase() || 'plaintext';
        const language = LANGUAGE_MAP[rawLanguage] || rawLanguage;
        const code = match[2].trim();
        const blockIndex = key;
        const ext = EXTENSIONS[language.toLowerCase()] || 'txt';
        const iconPath = getFileIconPath(`code.${ext}`);

        parts.push(
          <div
            key={`code-${key++}`}
            className="my-3 rounded-lg overflow-hidden border border-border"
          >
            <div className="bg-secondary/30 px-3 py-1.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={iconPath} alt={language} className="w-4 h-4 object-contain" />
                <span className="text-xs font-medium text-foreground uppercase">{language}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(code, blockIndex)}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Copy code"
                >
                  {copiedIndex === blockIndex ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleDownload(code, language)}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Download code"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
            <CodeBlock
              code={code}
              language={language}
              showLineNumbers={false}
              maxLines={30}
              disableClick={true}
              className="rounded-none"
              editorOptions={{
                guides: {
                  indentation: false,
                  bracketPairs: false,
                  highlightActiveIndentation: false,
                },
                renderLineHighlight: 'none',
                cursorStyle: 'line-thin',
                cursorBlinking: 'solid',
                domReadOnly: true,
                selectionHighlight: false,
                occurrencesHighlight: false,
                hover: { enabled: false },
              }}
            />
          </div>,
        );
      } else if (fullMatch.startsWith('**')) {
        const boldText = match[4];
        parts.push(
          <strong key={`bold-${key++}`} className="font-bold">
            {boldText}
          </strong>,
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${key++}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex)}
        </span>,
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{text}</span>;
  };

  return <div className="text-sm">{parseContent(content)}</div>;
};
