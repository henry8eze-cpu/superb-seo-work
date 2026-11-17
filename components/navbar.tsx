'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useLanguage()

  const navLinks = [
    { name: t('nav.about'), href: '#about' },
    { name: t('nav.courses'), href: '#courses' },
    { name: t('nav.pricing'), href: '#pricing' },
    { name: t('nav.contact'), href: '#contact' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full bg-white/95 backdrop-blur-md border-b border-border z-50 shadow-soft"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Superb Sprachschule"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="font-poppins font-bold text-xl text-dark-gray hidden sm:inline">
              Superb
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="font-inter text-sm font-medium text-dark-gray hover:text-primary transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher />
            <Link
              href="/auth/login"
              className="font-inter text-sm font-medium text-dark-gray hover:text-primary transition-colors"
            >
              {t('common.login')}
            </Link>
            <Link
              href="/register"
              className="bg-primary text-white px-6 py-2 rounded-lg font-inter font-medium hover:bg-opacity-90 transition-all shadow-soft hover:shadow-premium"
            >
              {t('common.register')}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-dark-gray" />
            ) : (
              <Menu className="w-6 h-6 text-dark-gray" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden pb-4 space-y-4"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block font-inter text-sm font-medium text-dark-gray hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-4 border-t border-border space-y-4">
              <div className="px-1">
                <LanguageSwitcher align="start" />
              </div>
              <Link
                href="/auth/login"
                className="block font-inter text-sm font-medium text-dark-gray hover:text-primary transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {t('common.login')}
              </Link>
              <Link
                href="/register"
                className="block w-full bg-primary text-white px-6 py-2 rounded-lg font-inter font-medium hover:bg-opacity-90 transition-all text-center"
                onClick={() => setIsOpen(false)}
              >
                {t('common.register')}
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  )
}
