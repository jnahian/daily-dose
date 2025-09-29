// Daily Dose Documentation Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  if (sidebarToggle && sidebar && sidebarOverlay) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("-translate-x-full");
      sidebarOverlay.classList.toggle("hidden");

      // Update icon
      const icon = sidebarToggle.querySelector("i");
      if (sidebar.classList.contains("-translate-x-full")) {
        icon.className = "fas fa-bars text-xl";
      } else {
        icon.className = "fas fa-times text-xl";
      }
    });

    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.add("-translate-x-full");
      sidebarOverlay.classList.add("hidden");
      const icon = sidebarToggle.querySelector("i");
      icon.className = "fas fa-bars text-xl";
    });
  }

  // Search functionality
  const searchInput = document.getElementById("search-input");

  function performSearch(query) {
    const sections = document.querySelectorAll("section");
    const navItems = document.querySelectorAll(".nav-item");

    if (!query.trim()) {
      // Show all sections and nav items
      sections.forEach((section) => {
        section.style.display = "";
        const content = section.innerHTML;
        section.innerHTML = content.replace(
          /<span class="search-highlight">(.*?)<\/span>/gi,
          "$1"
        );
      });
      navItems.forEach((item) => (item.style.display = ""));
      return;
    }

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    let hasResults = false;

    sections.forEach((section) => {
      const text = section.textContent.toLowerCase();
      const queryLower = query.toLowerCase();

      if (text.includes(queryLower)) {
        section.style.display = "";
        hasResults = true;

        // Highlight search terms
        const walker = document.createTreeWalker(
          section,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
          if (
            node.parentElement.tagName !== "SCRIPT" &&
            node.parentElement.tagName !== "STYLE"
          ) {
            textNodes.push(node);
          }
        }

        textNodes.forEach((textNode) => {
          if (regex.test(textNode.textContent)) {
            const parent = textNode.parentElement;
            const highlightedHTML = textNode.textContent.replace(
              regex,
              '<span class="search-highlight">$1</span>'
            );
            const wrapper = document.createElement("div");
            wrapper.innerHTML = highlightedHTML;

            while (wrapper.firstChild) {
              parent.insertBefore(wrapper.firstChild, textNode);
            }
            parent.removeChild(textNode);
          }
        });
      } else {
        section.style.display = "none";
      }
    });

    // Filter navigation items
    navItems.forEach((item) => {
      const text = item.textContent.toLowerCase();
      if (text.includes(queryLower)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });

    // Show "no results" message if needed
    if (!hasResults) {
      showNoResultsMessage();
    } else {
      hideNoResultsMessage();
    }
  }

  function showNoResultsMessage() {
    hideNoResultsMessage(); // Remove any existing message
    const main = document.querySelector("main");
    const noResults = document.createElement("div");
    noResults.id = "no-results";
    noResults.className = "text-center py-12";
    noResults.innerHTML = `
            <div class="text-gray-400 mb-4">
                <i class="fas fa-search text-4xl"></i>
            </div>
            <h3 class="text-xl font-semibold text-gray-600 mb-2">No results found</h3>
            <p class="text-gray-500">Try adjusting your search terms or browse the navigation menu.</p>
        `;
    main.appendChild(noResults);
  }

  function hideNoResultsMessage() {
    const noResults = document.getElementById("no-results");
    if (noResults) {
      noResults.remove();
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      performSearch(e.target.value);
    });
  }

  // Smooth scrolling for navigation links
  const navLinks = document.querySelectorAll('.nav-item[href^="#"]');
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        // Update active navigation item
        updateActiveNavItem(this);

        // Close mobile sidebar if open
        if (window.innerWidth < 768) {
          sidebar.classList.add("-translate-x-full");
          sidebarOverlay.classList.add("hidden");
          const icon = sidebarToggle.querySelector("i");
          icon.className = "fas fa-bars text-xl";
        }
      }
    });
  });

  // Update active navigation item based on scroll position
  function updateActiveNavItem(activeLink = null) {
    const navLinks = document.querySelectorAll('.nav-item[href^="#"]');

    navLinks.forEach((link) => {
      link.classList.remove("active");
    });

    if (activeLink) {
      activeLink.classList.add("active");
    } else {
      // Auto-detect based on scroll position
      const sections = document.querySelectorAll("section[id]");
      const scrollPos = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPos) {
          const correspondingLink = document.querySelector(
            `.nav-item[href="#${section.id}"]`
          );
          if (correspondingLink) {
            correspondingLink.classList.add("active");
          }
          break;
        }
      }
    }
  }

  // Update active nav item on scroll
  let scrollTimeout;
  window.addEventListener("scroll", function () {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateActiveNavItem, 100);
  });

  // Set initial active nav item
  updateActiveNavItem();

  // Copy to clipboard functionality
  window.copyToClipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          showNotification("Copied to clipboard!", "success");
        })
        .catch(function () {
          fallbackCopyToClipboard(text);
        });
    } else {
      fallbackCopyToClipboard(text);
    }
  };

  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      showNotification("Copied to clipboard!", "success");
    } catch (err) {
      showNotification("Failed to copy to clipboard", "error");
    }

    document.body.removeChild(textArea);
  }

  // Notification system
  function showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg transition-all transform translate-x-full ${
      type === "success"
        ? "bg-green-500 text-white"
        : type === "error"
        ? "bg-red-500 text-white"
        : "bg-blue-500 text-white"
    }`;

    notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${
                  type === "success"
                    ? "fa-check-circle"
                    : type === "error"
                    ? "fa-exclamation-circle"
                    : "fa-info-circle"
                } mr-2"></i>
                <span>${message}</span>
            </div>
        `;

    document.body.appendChild(notification);

    // Slide in
    setTimeout(() => {
      notification.classList.remove("translate-x-full");
    }, 100);

    // Slide out after duration
    setTimeout(() => {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Ctrl+F or Cmd+F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Escape to close mobile sidebar
    if (
      e.key === "Escape" &&
      !sidebar.classList.contains("-translate-x-full")
    ) {
      sidebar.classList.add("-translate-x-full");
      sidebarOverlay.classList.add("hidden");
      const icon = sidebarToggle.querySelector("i");
      if (icon) icon.className = "fas fa-bars text-xl";
    }
  });

  // Add loading animation to page
  window.addEventListener("load", function () {
    document.body.classList.add("loaded");
  });

  // Enhanced code block interactions
  const codeBlocks = document.querySelectorAll(".code-block");
  codeBlocks.forEach((block) => {
    // Add hover effect for copy button visibility
    block.addEventListener("mouseenter", function () {
      const copyBtn = this.querySelector(".copy-button");
      if (copyBtn) copyBtn.style.opacity = "1";
    });

    block.addEventListener("mouseleave", function () {
      const copyBtn = this.querySelector(".copy-button");
      if (copyBtn) copyBtn.style.opacity = "0";
    });
  });

  // Auto-expand sections based on URL hash
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      setTimeout(() => {
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - 100;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        const correspondingLink = document.querySelector(
          `.nav-item[href="#${targetId}"]`
        );
        if (correspondingLink) {
          updateActiveNavItem(correspondingLink);
        }
      }, 100);
    }
  }

  // Add tooltips for navigation icons
  const navIcons = document.querySelectorAll(".nav-item i");
  navIcons.forEach((icon) => {
    const parentLink = icon.closest(".nav-item");
    if (parentLink) {
      const text = parentLink.textContent.trim();
      icon.title = text;
    }
  });
});

// Utility functions
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Add a "scroll to top" button
function addScrollToTopButton() {
    const scrollBtn = document.createElement('button');
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollBtn.className = 'fixed bottom-6 right-6 bg-primary hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all transform scale-0 z-40';
    scrollBtn.id = 'scroll-to-top';
    scrollBtn.onclick = scrollToTop;
    document.body.appendChild(scrollBtn);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.remove('scale-0');
        } else {
            scrollBtn.classList.add('scale-0');
        }
    });
}

// Initialize scroll to top button
addScrollToTopButton();