import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "解题有形 · 行测理解实验室",
  description: "从零学习数量关系和图形推理：互动实验、立体模型、错题复盘与 AI 答疑。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head><link rel="stylesheet" href="/style.css" /><link rel="stylesheet" href="/ask.css" /></head><body>{children}</body></html>;
}
