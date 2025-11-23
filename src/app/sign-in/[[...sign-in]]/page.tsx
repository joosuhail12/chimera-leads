import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-chimera-navy/5 via-background to-chimera-teal/5">
      {/* Floating Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute left-[10%] top-[15%] h-64 w-64 animate-float rounded-none bg-chimera-teal/20 blur-2xl" />
        <div className="absolute right-[15%] top-[25%] h-80 w-80 animate-float-delayed rounded-none bg-chimera-purple/15 blur-3xl" />
        <div className="absolute bottom-[20%] left-[40%] h-72 w-72 animate-float rounded-none bg-chimera-lime/10 blur-2xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-8">
        <Link href="/" className="inline-block">
          <div className="brutal-glass w-fit p-4 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <Image
              src="/chimera-wordmark.png"
              alt="Chimera"
              width={200}
              height={44}
              priority
            />
          </div>
        </Link>
      </header>

      {/* Sign In Section */}
      <section className="relative flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 py-12">
        <div className="relative z-10 w-full max-w-md">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-4xl font-black uppercase tracking-tight text-foreground md:text-5xl">
              Welcome Back
            </h1>
            <p className="text-lg font-semibold uppercase tracking-wide text-foreground/70">
              Sign in to your account
            </p>
          </div>

          {/* Clerk Sign In Component Wrapper */}
          <div className="brutal-glass-teal p-8">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none border-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "brutal-glass-button border-3 border-chimera-teal hover:bg-chimera-teal hover:text-white font-bold uppercase tracking-wide transition-all",
                  socialButtonsBlockButtonText: "font-bold uppercase",
                  dividerLine: "bg-foreground/20",
                  dividerText: "text-foreground/60 font-bold uppercase text-xs",
                  formButtonPrimary:
                    "bg-chimera-teal hover:bg-chimera-purple border-3 border-chimera-teal hover:border-chimera-purple shadow-[5px_5px_0px_var(--chimera-teal)] hover:shadow-[7px_7px_0px_var(--chimera-purple)] font-black uppercase tracking-wider transition-all hover:translate-x-[-2px] hover:translate-y-[-2px]",
                  footerActionLink:
                    "text-chimera-teal hover:text-chimera-purple font-bold",
                  formFieldInput:
                    "bg-background/50 backdrop-blur-sm border-2 border-foreground/20 focus:border-chimera-teal font-semibold transition-all",
                  formFieldLabel: "font-bold uppercase text-sm text-foreground",
                  identityPreviewText: "font-semibold",
                  identityPreviewEditButton: "text-chimera-teal font-bold",
                },
              }}
            />
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-sm font-semibold text-foreground/60">
              Internal access only. Contact your administrator for account access.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t-3 border-foreground/10 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-4">
            <div className="brutal-glass p-2">
              <Image
                src="/chimera-badge-logo.png"
                alt="Chimera Logo"
                width={32}
                height={32}
              />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Chimera Lead Management System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
