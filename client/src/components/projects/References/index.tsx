import React, { useState } from 'react'
import { Breadcrumb, Button, Card, Heading, Select, Stack } from '@libretexts/davis-react';
import useProject from '../../../hooks/useProject';
import { useParams } from 'react-router-dom';
import { BookReferencesData, ReferenceFormatType, ReferenceFormatTypes } from './model';
import AddContent from './AddContent';

const  ReferenceManager:React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [bookReferencesFormat, setBookReferencesFormat] = useState<BookReferencesData>();
    const [showAddContentModal, setShowAddContentModal] = useState(false);
    
    const {project, isLoading: isLoadingProject} = useProject(id ?? "");
  return (
    <Stack direction="vertical" gap="md" className="py-8 px-16">
    <Stack direction="vertical" gap="xs" className="mb-2">
    <Heading level={2}>Reference Manager</Heading>
    {!isLoadingProject && project?.title && (
      <Breadcrumb className="ml-1">
        <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
        <Breadcrumb.Item href={`/projects/${id}`}>
          {project?.title}
        </Breadcrumb.Item>
        <Breadcrumb.Item isCurrent>Reference Manager</Breadcrumb.Item>
      </Breadcrumb>
    )}
  </Stack>
  
  <Card variant="elevated">
    <Card.Body>
      <Stack direction="vertical" gap="xs">
        <Select
        name="bookReferencesFormat"
        label="Book References Format"
        options={ReferenceFormatTypes.map(format => ({
          label: format,
          value: format,
        }))}
        placeholder="Select a format"
        value={bookReferencesFormat?.format ?? undefined}
        onChange={(e) =>
          setBookReferencesFormat({
            format: (e.target.value || undefined) as ReferenceFormatType | undefined,
          })
        }
        />
        <Button onClick={() => setShowAddContentModal(true)}>Add Content</Button>
      </Stack>
    </Card.Body>
  </Card>
  <AddContent
    open={showAddContentModal}
    onClose={() => setShowAddContentModal(false)}
    onAdd={() => {}}
    referenceFormat={bookReferencesFormat?.format}
  />
  </Stack>
  )
}

export default ReferenceManager;