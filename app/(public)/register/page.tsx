import { RegistrationForm } from '@/components/forms/registration-form'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { Check } from 'lucide-react'

export const metadata = {
  title: 'Register | Superb Sprachschule',
  description: 'Register with Superb Sprachschule to start your German learning journey.',
}

export default function RegisterPage() {
  return (
    <div className="bg-cream min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 py-16 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <h1 className="font-poppins text-4xl md:text-5xl font-bold text-dark-gray mb-4">
              Start Your <span className="text-primary">German Journey</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Register now to connect with our expert instructors and begin your German language learning adventure.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-premium p-8 md:p-12">
            <RegistrationForm />
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-secondary bg-opacity-20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-5 h-5 text-dark-gray" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-gray mb-2">Quick Response</h3>
              <p className="text-sm text-muted-foreground">
                Our team will contact you within 24 hours
              </p>
            </div>

            <div className="text-center">
              <div className="bg-secondary bg-opacity-20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-5 h-5 text-dark-gray" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-gray mb-2">Free Consultation</h3>
              <p className="text-sm text-muted-foreground">
                Discuss your goals with an expert instructor
              </p>
            </div>

            <div className="text-center">
              <div className="bg-secondary bg-opacity-20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-5 h-5 text-dark-gray" />
              </div>
              <h3 className="font-poppins font-semibold text-dark-gray mb-2">Personalized Plan</h3>
              <p className="text-sm text-muted-foreground">
                Get a customized learning path for your level
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
