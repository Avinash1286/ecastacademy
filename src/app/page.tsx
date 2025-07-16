import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React from 'react'

const page = () => {
  return (
    <div>
      This is landing page

      <Link href="/dashboard">
      <Button>Go to dashboard</Button>
      </Link>
    </div>
  )
}

export default page
