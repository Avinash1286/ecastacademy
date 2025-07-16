"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParams } from "next/navigation"

const page = () => {
  const params = useParams()
  
  const sampleCourse={
    "id": "e0b46fc7-bda8-4ba6-9d1a-c00c86512e49",
    "name": "MIT Introduction to Deep Learning | 6.S191",
    "description": "MIT 6.S191 (Introduction to Deep Learning) is a popular short course offered during MIT’s Independent Activities Period (IAP). The course provides students with:\n\nFoundational knowledge of deep learning algorithms, covering the core concepts behind neural networks and their applications.\n\nBeginner-friendly prerequisites: The only requirements are a basic understanding of calculus (e.g., derivatives) and linear algebra (e.g., matrix multiplication), with experience in Python helpful but not required. The course is designed to be accessible to a wide range of students, not limited to computer science majors.",
    "thumbnailUrl": "https://i.ytimg.com/vi/alfdI7S6wCY/maxresdefault.jpg",
    "chapters": [
      {
        "id": "4cb027d1-e8b6-49e2-8eb3-ae37a7837c73",
        "name": "MIT Introduction to Deep Learning | 6.S191",
        "order": 1,
        "duration": "1:09:26"
      },
      {
        "id": "909c9ea4-fb1d-45ee-b6b7-46dcc8e99354",
        "name": "MIT 6.S191: Recurrent Neural Networks, Transformers, and Attention",
        "order": 2,
        "duration": "1:01:34"
      },
      {
        "id": "6b618309-9d5f-47c7-941e-4e16afcb5184",
        "name": "MIT 6.S191: Convolutional Neural Networks",
        "order": 3,
        "duration": "1:01:04"
      },
      {
        "id": "ed16e22e-dd97-4d5f-9904-37b432012b9a",
        "name": "MIT 6.S191: Deep Generative Modeling",
        "order": 4,
        "duration": "48:57"
      },
      {
        "id": "e31e7282-31a2-4e3b-ba4f-2567a0173667",
        "name": "MIT 6.S191: Reinforcement Learning",
        "order": 5,
        "duration": "1:02:00"
      },
      {
        "id": "0b7d05c9-2b5f-4f13-b014-a68cd88ce053",
        "name": "MIT 6.S191: Language Models and New Frontiers",
        "order": 6,
        "duration": "47:36"
      },
      {
        "id": "780bc42d-54ba-4eaf-be48-ed8d0805cca6",
        "name": "MIT 6.S191 (Google): Large Language Models",
        "order": 7,
        "duration": "55:52"
      },
      {
        "id": "6e670307-69b7-495e-9eab-543dd40bcb1e",
        "name": "MIT 6.S191 (Liquid AI): Large Language Models",
        "order": 8,
        "duration": "1:08:18"
      },
      {
        "id": "ea96e006-c4ff-47ec-a236-c8fb07744d21",
        "name": "MIT 6.S191 (Comet ML): A Hipocratic Oath, for *your* AI",
        "order": 9,
        "duration": "51:26"
      },
      {
        "id": "c2a7db13-f665-4742-8289-c0996ff1e135",
        "name": "MIT 6.S191 (Microsoft): AI for Biology",
        "order": 10,
        "duration": "57:13"
      }
    ]
  }

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