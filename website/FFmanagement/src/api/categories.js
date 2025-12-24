// src/api/category.js

import axiosInstance from "@/utils/axios.config";

// Function to add a new category
export const addCategory = async (formData) => {
  console.log("yes reaching api : ")
  for (let pair of formData.entries()) {
    console.log(pair[0] + ': ' + pair[1]);
  }
  try {
    const response = await axiosInstance.post('/admin/addCategory', formData,{
      headers:{
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.log(error)
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const getCategories = async () => {
  try {
    const response = await axiosInstance.get('/admin/getCategories');
    return response.data;
  } catch (error) {
    console.log(error)
    throw error.response ? error.response.data : new Error('Network Error');
  }
};

export const getCategoryById = async (categoryId)=>{
  try{
    const response = await axiosInstance.get(`/admin/getCategoryById/${categoryId}`);
    return response.data;
  }catch(error){
    console.log(error)
    throw error.response ? error.response.data : new Error('Network Error');
  }
}

export const updateCategory =async(categoryData)=>{
  try{
    const response = await axiosInstance.put(`/admin/updateCategory/${categoryData._id}`,categoryData);
    return response.data;
  }catch(error){
    console.log(error)
    throw error.response ? error.response.data : new Error('Network Error');
  }
}


