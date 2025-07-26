import { notFound } from 'next/navigation';
import { getCourseChapters } from '@/lib/services/courseService';
import Learnspace from '@/components/learnspace/Learnspace';

export default async function LearningPage({ params }: { params: { id: string } }) {
  
  const {id}= params
  const chapters = await getCourseChapters(id);
  

  if (!chapters || chapters.length === 0) {
    notFound();
  }

  return <Learnspace initialChapters={chapters} />;
}