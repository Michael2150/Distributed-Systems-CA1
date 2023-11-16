// Movie type
export type Movie = {
  id: number;
  popularity: number;
  release_date: string;
  title: string;
};
  
// Review type
export type Review = {
  author: string;
  content: string;
  created_at: string;
  id: string;
  movie_id: number;
};

// Authentication Types
export type SignUpBody = {
  username: string;
  password: string;
  email: string
}
export type ConfirmSignUpBody = {
  username: string;
  code: string;
}
export type SignInBody = {
  username: string;
  password: string;
}
