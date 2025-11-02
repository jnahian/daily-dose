"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  title: string;
  href: string;
  items?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: "Getting Started",
    href: "#getting-started",
    items: [
      { title: "Installation", href: "#installation" },
      { title: "Quick Start", href: "#quick-start" },
      { title: "Configuration", href: "#configuration" },
    ],
  },
  {
    title: "Commands",
    href: "#commands",
    items: [
      { title: "Team Commands", href: "#team-commands" },
      { title: "Standup Commands", href: "#standup-commands" },
      { title: "Leave Commands", href: "#leave-commands" },
    ],
  },
  {
    title: "Features",
    href: "#features",
    items: [
      { title: "Automated Reminders", href: "#automated-reminders" },
      { title: "Multi-Team Support", href: "#multi-team-support" },
      { title: "Leave Management", href: "#leave-management" },
    ],
  },
  {
    title: "Configuration",
    href: "#config",
    items: [
      { title: "Reminder Time", href: "#reminder-time" },
      { title: "Posting Time", href: "#posting-time" },
      { title: "Work Days", href: "#work-days" },
      { title: "Timezone", href: "#timezone" },
    ],
  },
  {
    title: "Advanced",
    href: "#advanced",
    items: [
      { title: "Webhooks", href: "#webhooks" },
      { title: "API Reference", href: "#api-reference" },
      { title: "Troubleshooting", href: "#troubleshooting" },
    ],
  },
];

interface DocsSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function DocsSidebar({ isOpen = true, onClose }: DocsSidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        "fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-300 lg:translate-x-0",
        {
          "translate-x-0": isOpen,
          "-translate-x-full": !isOpen,
        }
      )}
    >
      <div className="p-6 space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search docs..."
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <svg
            className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navigation.map((section) => (
            <div key={section.href} className="space-y-1">
              <a
                href={section.href}
                onClick={handleLinkClick}
                className="block px-3 py-2 text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
              >
                {section.title}
              </a>
              {section.items && (
                <div className="ml-3 space-y-1 border-l border-gray-200 pl-3">
                  {section.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className="block py-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Quick Links */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Links
          </h4>
          <div className="space-y-1">
            <Link
              href="/changelog"
              className="block px-3 py-2 text-sm text-gray-600 hover:text-primary transition-colors"
            >
              📋 Changelog
            </Link>
            <a
              href="https://github.com/yourusername/daily-dose-bot"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-gray-600 hover:text-primary transition-colors"
            >
              💻 GitHub
            </a>
            <a
              href="mailto:support@dailydose.app"
              className="block px-3 py-2 text-sm text-gray-600 hover:text-primary transition-colors"
            >
              📧 Support
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
