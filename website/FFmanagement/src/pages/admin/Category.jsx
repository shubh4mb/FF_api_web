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
        console.log(response);
        
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

     const CategoryColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    { header: "Name", accessor: "name" },
    { header: "Slug", accessor: "slug" },
    { header: "Level", accessor: "level" },
    {
      header: "Status",
      accessor: "isActive",
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs ${value ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const CategoryActions = [
    {
      label: "Edit",
      // onClick: (row) => navigate(`/admin/category/${row._id}`), // 👈 navigate to route
      onClick: (row) => navigate(`/admin/edit-category/${row._id}`), // 👈 navigate to route
      className: "text-blue-600 hover:underline text-sm",
    },
    {
      label: "View Products",
      onClick: (row) => navigate(`/admin/products/merchant/${row._id}`),
      className: "text-blue-600 hover:underline text-sm",
    },
    {
      label: "Delete",
      onClick: (row) => console.log("Delete", row),
      className: "text-red-600 hover:underline text-sm",
    },
  ];
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
      <Table data={categoriesData} columns={CategoryColumns} actions={CategoryActions}/>
    </div>
    
  </>
  );
}
