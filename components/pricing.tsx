'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

export function Pricing() {
  const { t } = useLanguage()
  const features = t('pricing.plan.features') as unknown as string[]

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium font-poppins mb-4">
            {t('pricing.title')}
          </span>
          <h2 className="text-4xl md:text-5xl font-poppins font-bold text-dark-gray mb-4 text-balance">
            {t('pricing.headline')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-inter">
            {t('pricing.description')}
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-md mx-auto"
        >
          <div className="rounded-2xl overflow-hidden bg-primary bg-weave text-white shadow-premium">
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-poppins font-bold mb-2 text-white">
                  {t('pricing.plan.name')}
                </h3>
                <p className="text-sm text-white/80">
                  {t('pricing.plan.description')}
                </p>
              </div>

              <div className="mb-8 pb-8 border-b border-opacity-20 border-current">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-poppins font-bold">
                    {t('pricing.plan.price')}
                  </span>
                  <span className="text-white/80">{t('pricing.plan.period')}</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-secondary" />
                    <span className="text-sm font-inter text-white/90">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/register"
                className="block w-full text-center py-3 rounded-xl font-poppins font-bold transition-all bg-secondary text-dark-gray hover:bg-opacity-90"
              >
                {t('pricing.plan.cta')}
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground font-inter">
            {t('pricing.customPlan')}{' '}
            <a href="#contact" className="text-primary font-bold hover:underline">
              {t('common.contact')}
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
