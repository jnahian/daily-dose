import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

export function Footer() {
  return (
    <footer className="bg-black py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img src="/logo.png" alt="Daily Dose Logo" className="h-8 w-8" />
              <span className="text-xl font-bold text-white">Daily Dose</span>
            </div>
            <p className="text-gray-400 max-w-md">
              Automate your team's daily standups with intelligence and style.
              Save time, improve communication, boost productivity.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/documentation/user-guide"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/changelog"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@dailydose.bot"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <Link
                  to="/documentation/scripts"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Scripts Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/jnahian/daily-dose"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faGithub} />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 Daily Dose. Made with ❤️ for productive teams everywhere.
          </p>
        </div>
      </div>
    </footer>
  )
}
