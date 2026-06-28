import "./globals.css";

export const metadata = {
  title: "Margin — budgeting for trades",
  description:
    "Job costing, bidding, deposits, invoices and cash flow for trades contractors.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ECE7DC",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
