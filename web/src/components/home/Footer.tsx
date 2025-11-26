import { Link } from 'react-router';

export const Footer = () => (
  <footer className="bg-bg-primary border-t border-border-default py-12 transition-colors duration-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-text-primary font-bold text-xl tracking-tight">Daily Dose</span>
          </div>
          <p className="text-text-secondary max-w-xs">
            The modern standup bot for high-performing teams. Built for Slack.
          </p>
        </div>

        <div>
          <h4 className="text-text-primary font-bold mb-4">Product</h4>
          <ul className="space-y-2 text-text-secondary">
            <li>
              <a href="#features" className="hover:text-brand-cyan transition-colors">
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="hover:text-brand-cyan transition-colors">
                How it Works
              </a>
            </li>
            <li>
              <Link to="/docs" className="hover:text-brand-cyan transition-colors">
                Documentation
              </Link>
            </li>
            <li>
              <Link to="/changelog" className="hover:text-brand-cyan transition-colors">
                Changelog
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-text-primary font-bold mb-4">Legal</h4>
          <ul className="space-y-2 text-text-secondary">
            <li>
              <a href="#" className="hover:text-brand-cyan transition-colors">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-cyan transition-colors">
                Terms of Service
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-cyan transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-border-default text-center text-text-secondary text-sm">
        © {new Date().getFullYear()} Daily Dose Bot. All rights reserved.
      </div>
    </div>
  </footer>
);
