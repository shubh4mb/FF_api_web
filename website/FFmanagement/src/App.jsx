import AppRoutes from './routes/AppRoutes';
import { Toaster } from 'sonner'; 

function App() {
  return (
    <>
       <Toaster position='top-right'/>
       <AppRoutes />
   </>
 

  )
}

export default App;
