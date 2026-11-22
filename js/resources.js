// Curated free learning resources per roadmap task: official docs and free courses first.
// Keyed on task ids from data.js. Your own links per task are stored in data.links.
const R = {
  'm0-2': [
    ['Download Python', 'https://www.python.org/downloads/'],
    ['Python di VS Code', 'https://code.visualstudio.com/docs/python/python-tutorial'],
    ['Pro Git (buku gratis)', 'https://git-scm.com/book/en/v2'],
  ],
  'm1-1': [
    ['Tutorial resmi Python', 'https://docs.python.org/3/tutorial/'],
    ['Kaggle Learn: Python', 'https://www.kaggle.com/learn/python'],
  ],
  'm1-2': [['Python docs: Data Structures', 'https://docs.python.org/3/tutorial/datastructures.html']],
  'm1-3': [
    ['Python docs: Classes', 'https://docs.python.org/3/tutorial/classes.html'],
    ['Python docs: Modules', 'https://docs.python.org/3/tutorial/modules.html'],
    ['Python docs: venv', 'https://docs.python.org/3/tutorial/venv.html'],
  ],
  'm1-4': [
    ['NumPy untuk pemula', 'https://numpy.org/doc/stable/user/absolute_beginners.html'],
    ['NumPy: Broadcasting', 'https://numpy.org/doc/stable/user/basics.broadcasting.html'],
  ],
  'm1-5': [
    ['Tutorial resmi pandas', 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/index.html'],
    ['Kaggle Learn: Pandas', 'https://www.kaggle.com/learn/pandas'],
  ],
  'm1-6': [
    ['Tutorial Matplotlib', 'https://matplotlib.org/stable/tutorials/index.html'],
    ['Kaggle Learn: Data Visualization', 'https://www.kaggle.com/learn/data-visualization'],
  ],
  'm2-1': [
    ['3Blue1Brown: Essence of Linear Algebra', 'https://www.3blue1brown.com/topics/linear-algebra'],
    ['Khan Academy: Linear Algebra', 'https://www.khanacademy.org/math/linear-algebra'],
  ],
  'm2-2': [
    ['Khan Academy: Statistics & Probability', 'https://www.khanacademy.org/math/statistics-probability'],
    ['StatQuest (YouTube)', 'https://www.youtube.com/@statquest'],
  ],
  'm2-3': [
    ['scikit-learn: Linear Models', 'https://scikit-learn.org/stable/modules/linear_model.html'],
    ['Google ML Crash Course', 'https://developers.google.com/machine-learning/crash-course'],
  ],
  'm2-4': [
    ['scikit-learn: Cross-validation', 'https://scikit-learn.org/stable/modules/cross_validation.html'],
    ['scikit-learn: Model evaluation', 'https://scikit-learn.org/stable/modules/model_evaluation.html'],
  ],
  'm2-5': [
    ['scikit-learn: Decision Trees', 'https://scikit-learn.org/stable/modules/tree.html'],
    ['scikit-learn: Ensembles', 'https://scikit-learn.org/stable/modules/ensemble.html'],
    ['Kaggle Learn: Intro to ML', 'https://www.kaggle.com/learn/intro-to-machine-learning'],
  ],
  'm2-6': [['Kaggle: Titanic', 'https://www.kaggle.com/competitions/titanic']],
  'm3-1': [
    ['Kaggle Learn: Feature Engineering', 'https://www.kaggle.com/learn/feature-engineering'],
    ['scikit-learn: Pipelines', 'https://scikit-learn.org/stable/modules/compose.html'],
  ],
  'm3-2': [
    ['LightGBM docs', 'https://lightgbm.readthedocs.io/en/stable/'],
    ['XGBoost docs', 'https://xgboost.readthedocs.io/en/stable/'],
  ],
  'm3-3': [
    ['scikit-learn: Clustering', 'https://scikit-learn.org/stable/modules/clustering.html'],
    ['scikit-learn: PCA', 'https://scikit-learn.org/stable/modules/decomposition.html'],
  ],
  'm3-4': [['Kaggle Learn: Intermediate ML', 'https://www.kaggle.com/learn/intermediate-machine-learning']],
  'm3-5': [
    ['Streamlit docs', 'https://docs.streamlit.io/'],
    ['Hugging Face Spaces', 'https://huggingface.co/docs/hub/spaces'],
  ],
  'm4-1': [
    ['PyTorch: Tensors', 'https://pytorch.org/tutorials/beginner/basics/tensorqs_tutorial.html'],
    ['PyTorch: Autograd', 'https://pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html'],
  ],
  'm4-2': [
    ['PyTorch: Build the Model', 'https://pytorch.org/tutorials/beginner/basics/buildmodel_tutorial.html'],
    ['Karpathy: micrograd dari nol (video)', 'https://www.youtube.com/watch?v=VMj-3S1tku0'],
  ],
  'm4-3': [['PyTorch: Optimization loop', 'https://pytorch.org/tutorials/beginner/basics/optimization_tutorial.html']],
  'm4-4': [
    ['PyTorch: Training a classifier (CIFAR-10)', 'https://pytorch.org/tutorials/beginner/blitz/cifar10_tutorial.html'],
    ['fast.ai: Practical Deep Learning', 'https://course.fast.ai/'],
  ],
  'm4-5': [['PyTorch: Transfer learning', 'https://pytorch.org/tutorials/beginner/transfer_learning_tutorial.html']],
  'm4-6': [
    ['Gradio quickstart', 'https://www.gradio.app/guides/quickstart'],
    ['Hugging Face Spaces', 'https://huggingface.co/docs/hub/spaces'],
  ],
  'm5-1': [
    ['The Illustrated Transformer', 'https://jalammar.github.io/illustrated-transformer/'],
    ['Hugging Face LLM Course', 'https://huggingface.co/learn/llm-course/chapter1/1'],
  ],
  'm5-2': [
    ['Hugging Face LLM Course', 'https://huggingface.co/learn/llm-course/chapter1/1'],
    ['Transformers: Pipelines', 'https://huggingface.co/docs/transformers/main_classes/pipelines'],
  ],
  'm5-3': [
    ['Claude docs: Prompt engineering', 'https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview'],
    ['Prompt Engineering Guide', 'https://www.promptingguide.ai/'],
  ],
  'm5-4': [
    ['Hugging Face Cookbook: Advanced RAG', 'https://huggingface.co/learn/cookbook/advanced_rag'],
    ['Sentence Transformers (embedding)', 'https://sbert.net/'],
    ['Chroma (vector store)', 'https://docs.trychroma.com/'],
  ],
  'm5-5': [['Kaggle Competitions', 'https://www.kaggle.com/competitions']],
  'm6-1': [
    ['Hugging Face Cookbook: Advanced RAG', 'https://huggingface.co/learn/cookbook/advanced_rag'],
    ['Chroma (vector store)', 'https://docs.trychroma.com/'],
  ],
  'm6-2': [['GitHub: About READMEs', 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes']],
  'm6-3': [['Google Technical Writing (gratis)', 'https://developers.google.com/tech-writing']],
  'm6-4': [['GitHub: Profile README', 'https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme']],
};

/** Curated links for a task as [{t, u}] (empty for tasks without any). */
export const resourcesFor = (id) => (R[id] ?? []).map(([t, u]) => ({ t, u }));
