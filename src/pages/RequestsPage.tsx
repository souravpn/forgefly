import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Requests are now merged into the Proposals page (origin filter: "Requested").
export default function RequestsPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/dashboard/proposals', { replace: true })
  }, [navigate])
  return null
}
