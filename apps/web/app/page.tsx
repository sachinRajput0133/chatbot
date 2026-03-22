import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl">
        <h1 className="text-5xl font-bold text-indigo-600 mb-4">ChatBot AI</h1>
        <p className="text-xl text-gray-600 mb-8">
          Add a smart AI chatbot to any website in 30 seconds.
          <br />
          One script tag. No developer needed.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition"
          >
            Start for Free
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition"
          >
            Login
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-8 text-left">
          {[
            { title: "Upload Your Content", desc: "Add your FAQ, menu, or product docs. We train the bot instantly." },
            { title: "Customize the Look", desc: "Set your brand color, bot name, and welcome message." },
            { title: "Paste One Script Tag", desc: "Copy one line of code. Works on WordPress, Wix, Shopify, any site." },
          ].map((f) => (
            <div key={f.title} className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
