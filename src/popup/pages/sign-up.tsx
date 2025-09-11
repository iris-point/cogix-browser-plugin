import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const SignUpPage = () => {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Redirect to sign-in page which handles both sign-in and sign-up
    // The sign-in page has buttons for both actions
    navigate('/sign-in')
  }, [navigate])
  
  return null
}