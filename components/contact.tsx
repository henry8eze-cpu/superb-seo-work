'use client'

import { motion } from 'framer-motion'
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

export function Contact() {
  const { t } = useLanguage()
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <section id="contact" className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-24 bg-dark-gray rounded-3xl p-10 md:p-14 text-white grid md:grid-cols-[1fr_auto] gap-10 items-center"
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-poppins font-bold mb-4 text-balance">
              {t('contact.ctaTitle')}
            </h2>
            <p className="text-lg text-white/70 max-w-xl font-inter">
              {t('contact.ctaSubtitle')}
            </p>
          </div>
          <div className="flex md:flex-col items-start md:items-end gap-6">
            <div className="text-start md:text-end">
              <div className="text-3xl font-poppins font-bold text-secondary">500+</div>
              <div className="text-sm text-white/60">students already enrolled</div>
            </div>
            <Link
              href="/register"
              className="bg-secondary text-dark-gray px-6 py-3.5 rounded-xl font-poppins font-bold hover:bg-opacity-90 transition-all inline-flex items-center gap-2 whitespace-nowrap"
            >
              {t('contact.ctaButton')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Contact Info */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
        >
          {[
            {
              icon: Mail,
              title: t('contact.email'),
              content: 'hello@superbsprachschule.de',
              href: 'mailto:hello@superbsprachschule.de',
            },
            {
              icon: Phone,
              title: t('contact.phone'),
              content: '+49 176 74865418',
              href: 'tel:+4917674865418',
            },
            {
              icon: MapPin,
              title: t('contact.location'),
              content: 'Essen, Germany',
              href: '#',
            },
          ].map((item, index) => {
            const Icon = item.icon
            return (
              <motion.a
                key={index}
                variants={itemVariants}
                href={item.href}
                className="text-center p-8 bg-white rounded-2xl border border-border hover:shadow-premium hover:-translate-y-2 transition-all group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-primary group-hover:text-white transition-all">
                  <Icon className="w-6 h-6 text-primary group-hover:text-white" />
                </div>
                <h3 className="font-poppins font-bold text-dark-gray mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground font-inter">
                  {item.content}
                </p>
              </motion.a>
            )
          })}
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto bg-white rounded-2xl p-8 md:p-12 border border-border"
        >
          <h3 className="text-2xl font-poppins font-bold text-dark-gray mb-8">
            {t('contact.formTitle')}
          </h3>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input
                type="text"
                placeholder={t('contact.yourName')}
                className="px-6 py-3 bg-cream border border-border rounded-xl font-inter focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
              <input
                type="email"
                placeholder={t('contact.yourEmail')}
                className="px-6 py-3 bg-cream border border-border rounded-xl font-inter focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
            <input
              type="text"
              placeholder={t('contact.subject')}
              className="w-full px-6 py-3 bg-cream border border-border rounded-xl font-inter focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <textarea
              rows={5}
              placeholder={t('contact.yourMessage')}
              className="w-full px-6 py-3 bg-cream border border-border rounded-xl font-inter focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            />
            <button
              type="submit"
              className="w-full bg-primary text-white px-8 py-4 rounded-xl font-poppins font-bold text-lg hover:shadow-premium transition-all"
            >
              {t('contact.send')}
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  )
}
