import { useState } from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { DocsSidebar, ContentRenderer } from "../components/docs";
import mcpDocsData from "../data/mcpDocs.json";
import type { DocsData } from "../types/docs";

export const meta = () => {
  return [
    { title: "MCP Documentation - Daily Dose | Use Standups from any AI Agent" },
    {
      name: "description",
      content:
        "Connect Daily Dose to Claude Desktop, Cursor, VS Code, or any MCP-compatible AI agent. Automatic Slack sign-in, every tool, and example prompts.",
    },
    {
      name: "keywords",
      content:
        "daily dose mcp, model context protocol, claude desktop standup, cursor mcp, ai agent standup",
    },
    { name: "author", content: "Daily Dose" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://dd.jnahian.me/docs/mcp" },
    {
      property: "og:title",
      content: "Daily Dose MCP - Run standups from your AI agent",
    },
    {
      property: "og:description",
      content:
        "Connect Daily Dose to any MCP-compatible AI agent with automatic Slack sign-in.",
    },
    { property: "og:image", content: "/logo.png" },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:url", content: "https://dd.jnahian.me/docs/mcp" },
    {
      property: "twitter:title",
      content: "Daily Dose MCP - Run standups from your AI agent",
    },
    {
      property: "twitter:description",
      content:
        "Connect Daily Dose to any MCP-compatible AI agent with automatic Slack sign-in.",
    },
    { property: "twitter:image", content: "/logo.png" },
  ];
};

const McpDocs = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("ai-agent-mcp");
  const [searchQuery, setSearchQuery] = useState("");

  const data = mcpDocsData as DocsData;

  const filteredSections = data.sections
    .map((section) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return section;

      if (section.title.toLowerCase().includes(query)) return section;

      const matchingSubsections = section.subsections.filter((sub) =>
        sub.title.toLowerCase().includes(query)
      );

      if (matchingSubsections.length > 0) {
        return { ...section, subsections: matchingSubsections };
      }

      return null;
    })
    .filter(
      (section): section is (typeof data.sections)[0] => section !== null
    );

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 md:hidden z-50 w-12 h-12 bg-brand-cyan rounded-full flex items-center justify-center shadow-lg hover:shadow-brand-cyan/50 transition-shadow"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Container for sidebar and content */}
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex md:gap-8">
            <DocsSidebar
              isOpen={sidebarOpen}
              setIsOpen={setSidebarOpen}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sections={data.sections}
            />

            {/* Main content */}
            <main className="flex-1 min-w-0 py-6 md:py-12">
              {/* Header */}
              <div className="mb-12">
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-cyan transition-colors mb-4"
                >
                  <ArrowLeft size={16} />
                  Back to Documentation
                </Link>
                <h1 className="text-5xl font-bold text-text-primary mb-4">
                  AI Agent (MCP)
                </h1>
                <p className="text-xl text-text-secondary">
                  Operate Daily Dose from any MCP-compatible AI agent — submit
                  standups, review your team, and run admin actions without
                  opening Slack.
                </p>
              </div>

              {/* Render MCP sections */}
              {filteredSections.length > 0 ? (
                filteredSections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="mb-16 scroll-mt-24"
                  >
                    <div className="prose prose-invert max-w-none">
                      {section.subsections.map((subsection) => (
                        <div
                          key={subsection.id}
                          id={subsection.id}
                          className="mt-8 scroll-mt-24"
                        >
                          <h3 className="text-2xl font-bold text-text-primary mb-4">
                            {subsection.title}
                          </h3>
                          <ContentRenderer content={subsection.content} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-xl text-text-secondary">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default McpDocs;
