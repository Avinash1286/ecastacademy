"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParams } from "next/navigation"

const page = () => {
  const params = useParams()
  console.log(params.id)
  return (
    <div className="container mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:px-8">
      <Link href={`/learnspace/${params.id}`}>
      THis is Course Detailed page where all the information about the course will be displayed
        <Button>Go to course</Button>
      </Link>
    </div>
  )
}

export default page