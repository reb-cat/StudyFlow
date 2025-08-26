import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { FaTwitter, FaLinkedin } from "react-icons/fa";

const footerSections = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "#" },
      { name: "Pricing", href: "#" },
      { name: "API", href: "#" },
      { name: "Documentation", href: "#" }
    ]
  },
  {
    title: "Support",
    links: [
      { name: "Help Center", href: "#" },
      { name: "Contact Us", href: "#" },
      { name: "Accessibility", href: "#" },
      { name: "Status", href: "#" }
    ]
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "#" },
      { name: "Privacy", href: "#" },
      { name: "Terms", href: "#" },
      { name: "Security", href: "#" }
    ]
  }
];

export default function Footer() {
  return (
    <motion.footer 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="border-t border-border bg-secondary/50"
      data-testid="footer"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4" data-testid="footer-brand">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold text-foreground">StudyFlow</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="footer-description">
              Empowering students with executive function differences to achieve their academic potential.
            </p>
          </div>

          {footerSections.map((section, index) => (
            <div key={index} data-testid={`footer-section-${index}`}>
              <h3 className="font-medium text-foreground mb-4" data-testid={`footer-section-title-${index}`}>
                {section.title}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a 
                      href={link.href} 
                      className="hover:text-foreground transition-colors"
                      data-testid={`footer-link-${index}-${linkIndex}`}
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center" data-testid="footer-bottom">
          <p className="text-sm text-muted-foreground" data-testid="footer-copyright">
            © 2024 StudyFlow. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0" data-testid="footer-social">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="social-twitter"
              aria-label="Twitter"
            >
              <FaTwitter className="w-5 h-5" />
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="social-linkedin"
              aria-label="LinkedIn"
            >
              <FaLinkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
