'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, Globe, Share2, MessageCircle } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

export function Footer() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  const footerSections = [
    {
      title: t('footer.courses'),
      links: [
        { name: 'Beginner (A1-A2)', href: '#courses' },
        { name: 'Intermediate (B1-B2)', href: '#courses' },
        { name: 'Advanced (C1)', href: '#courses' },
        { name: 'Goethe/TestDaF', href: '#courses' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { name: 'About Us', href: '#about' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'Contact', href: '#contact' },
        { name: 'Blog', href: '#' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { name: 'Privacy Policy', href: '#' },
        { name: 'Terms of Service', href: '#' },
        { name: 'Cookie Policy', href: '#' },
        { name: 'Sitemap', href: '#' },
      ],
    },
  ]

  const socialLinks = [
    { icon: Mail, href: '#', label: 'Email' },
    { icon: Globe, href: '#', label: 'Website' },
    { icon: Share2, href: '#', label: 'Share' },
    { icon: MessageCircle, href: '#', label: 'Contact' },
  ]

  return (
    <footer className="bg-dark-gray text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12"
        >
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Image
                src="/logo.png"
                alt="Superb Sprachschule"
                width={40}
                height={40}
                className="w-10 h-10"
              />
              <span className="font-poppins font-bold text-xl">Superb</span>
            </Link>
            <p className="text-gray-400 font-inter leading-relaxed mb-6">
              CEFR-aligned German courses, taught in Essen and online, from A1 through Goethe exam prep.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social, index) => {
                const Icon = social.icon
                return (
                  <motion.a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    whileHover={{ scale: 1.2 }}
                    className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-primary transition-all"
                  >
                    <Icon className="w-5 h-5" />
                  </motion.a>
                )
              })}
            </div>
          </div>

          {/* Footer Links */}
          {footerSections.map((section, index) => (
            <div key={index}>
              <h4 className="font-poppins font-bold text-lg mb-6 text-white">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link, i) => (
                  <li key={i}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-primary transition-colors font-inter"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="border-t border-white/10 my-12" />

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <p className="text-gray-400 font-inter text-center md:text-start">
            © {currentYear} Superb Sprachschule. {t('footer.copyright')}.
          </p>
          <p className="text-gray-400 font-inter text-center">
            Based in Essen · Classes online and on-site
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
