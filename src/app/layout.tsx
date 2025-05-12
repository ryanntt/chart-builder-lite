
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'ag-charts-community/styles/ag-charts-community.css'; // Core AG Charts CSS (includes default light/dark themes)
import { Toaster } from "@/components/ui/toaster"; // Ensure Toaster is here for global access
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CSV Atlas Uploader & Visualizer',
  description: 'Upload CSV data and visualize it.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
