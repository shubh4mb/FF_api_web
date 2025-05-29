import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { getCategories } from "@/api/categories";
import { useEffect , useState } from "react";
import Table from "@/components/admin/Table";

export default function CategoryTableHeader() {
  
  const navigate = useNavigate();
  const [categoriesData,setCategoriesData]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(() => {
    setLoading(true);
    const getCategoriesData=async()=>{
      try {
        const response = await getCategories();
        console.log("yes reaching api : ")
        console.log(response.categories);
        setCategoriesData(response.categories);
        
      } catch (error) {
        console.error(error);
      } finally{
        setLoading(false);
      }
    }
    getCategoriesData();
    },[]);
    if(loading){
      return <div>Loading...</div>
    }
  return (
  <>
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b">

      
      {/* Left side: Search and Filters */}
      <div className="flex flex-1 items-center gap-4 flex-wrap">
        {/* Search */}
        <Input
          type="text"
          placeholder="Search categories..."
          className="max-w-sm"
        />

        {/* Sort */}
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
          </SelectContent>
        </Select>

        {/* Filter */}
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Right side: Add Category button */}
      <div className="flex justify-end">
        <Button onClick={()=>{navigate('/admin/add-category')}}>Add Category</Button>
      </div>
      <Table data={categoriesData}/>
    </div>
    
  </>
  );
}
