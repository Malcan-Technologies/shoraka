"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Logo } from "@cashsouk/ui";
import { RoleSelectionModal } from "./role-selection-modal";

export function Navbar() {
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
          </Link>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              className="text-[15px] hover:bg-transparent hover:text-primary"
              onClick={() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/85291801-5a79-4781-80fd-9a72660bf4b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'navbar.tsx:23',message:'Login button clicked',data:{currentPath:typeof window !== 'undefined' ? window.location.pathname : 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                setShowLoginModal(true);
              }}
            >
              Login
            </Button>
            <Link href="/get-started">
              <Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 text-[15px]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <RoleSelectionModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </nav>
  );
}

