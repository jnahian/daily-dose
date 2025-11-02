"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: Array<{ href: string; label: string }>;
}

export default function MobileMenu({
  isOpen,
  onClose,
  links,
}: MobileMenuProps) {
  return (
    <div
      className={cn(
        "md:hidden fixed inset-0 top-16 bg-white z-40 transition-transform duration-300",
        {
          "translate-x-0": isOpen,
          "translate-x-full": !isOpen,
        }
      )}
    >
      <div className="flex flex-col space-y-4 p-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="text-lg text-gray-700 hover:text-primary transition-colors font-medium py-2"
          >
            {link.label}
          </Link>
        ))}
        <a
          href="https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=commands,chat:write&user_scope="
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slack-purple text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all font-medium text-center"
        >
          Add to Slack
        </a>
      </div>
    </div>
  );
}
