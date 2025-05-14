
import type {Metadata} from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import '@/app/globals.css';
// import 'ag-charts-community/styles/ag-charts-community.css'; // Core AG Charts CSS (includes default light/dark themes)
// import 'ag-charts-community/styles/ag-theme-alpine.css'; // Alpine theme
// import 'ag-charts-community/styles/ag-theme-alpine-dark.css'; // Alpine dark theme
// The above imports are commented out because they consistently cause a "Module not found" error.
// This indicates that the build process cannot locate these CSS files within the ag-charts-community package.
// AG Charts may not be styled correctly until this is resolved.
// Please ensure 'ag-charts-community' is correctly installed and the path to its CSS is valid.
import { Toaster } from "@/components/ui/toaster"; // Ensure Toaster is here for global access
import { ThemeProvider } from "@/components/theme-provider";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
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
      <body className={`${ibmPlexSans.variable} font-sans antialiased bg-bg-color-secondary text-foreground`}>
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

